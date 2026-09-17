import { eq, isNull } from "drizzle-orm";
import { db } from "@/db/index.ts";
import {
	intakeReconciliationCandidates,
	intakeReconciliations,
	type JsonValue,
} from "@/db/schema/intake-reconciliations.ts";
import { members } from "@/db/schema/members.ts";
import { insertMember } from "@/features/members/create-member/index.ts";
import {
	type MatchCandidatePerson,
	matchPerson,
} from "@/lib/person-matching.ts";
import {
	buildIntakeBackfillPatch,
	type ExistingMemberFields,
} from "./backfill.ts";
import type { MemberIntakeValues } from "./schema.ts";

export type MemberIntakeResult =
	| { outcome: "created"; memberId: string }
	| { outcome: "updated"; memberId: string; backfilledFields: string[] }
	| {
			outcome: "needs_review";
			reconciliationId: string;
			candidateCount: number;
	  };

const existingMemberColumns = {
	id: members.id,
	name: members.name,
	email: members.email,
	phone: members.phone,
	gender: members.gender,
	residence: members.residence,
	fieldOfStudy: members.fieldOfStudy,
	areaGroup: members.areaGroup,
	yearOfStudy: members.yearOfStudy,
} as const;

type ExistingMemberRow = { id: string; name: string } & ExistingMemberFields;

/**
 * Everyone eligible to be matched against — excludes already-removed
 * members, the same rule the removal webhook applies to its own candidate
 * pool. A removed person re-submitting the form should read as "not on file"
 * (CONFIDENT_CREATE), not silently write new data onto a soft-deleted row.
 */
async function selectMatchCandidates(): Promise<MatchCandidatePerson[]> {
	return db
		.select({
			id: members.id,
			name: members.name,
			email: members.email,
			phone: members.phone,
		})
		.from(members)
		.where(isNull(members.removedAt));
}

/**
 * Creates a member, backfills one that `matchPerson` confidently identified,
 * or — when it can't confidently decide — stages an `intake_reconciliations`
 * row with every candidate it found and touches no person record at all.
 * That last branch is the key change from the matching this replaced: an
 * ambiguous or uncorroborated submission used to get resolved one way or the
 * other automatically; now a human decides.
 */
export async function upsertMemberFromIntake(
	values: MemberIntakeValues,
	rawPayload: JsonValue,
): Promise<MemberIntakeResult> {
	const candidates = await selectMatchCandidates();
	const match = matchPerson(
		{
			firstName: values.firstName,
			surname: values.surname,
			email: values.email,
			phone: values.phone,
		},
		candidates,
	);

	if (match.outcome === "CONFIDENT_CREATE") {
		const created = await insertMember({
			name: `${values.firstName} ${values.surname}`,
			leaderId: null,
			phone: values.phone,
			email: values.email,
			gender: values.gender,
			residence: values.residence,
			fieldOfStudy: values.fieldOfStudy,
			areaGroup: values.areaGroup,
			yearOfStudy: values.yearOfStudy,
			status: "new",
		});
		return { outcome: "created", memberId: created.id };
	}

	if (match.outcome === "CONFIDENT_UPDATE") {
		const [existing] = await db
			.select(existingMemberColumns)
			.from(members)
			.where(eq(members.id, match.personId));

		if (!existing) {
			throw new Error("Matched member no longer exists.");
		}

		const patch = buildIntakeBackfillPatch(
			existing as ExistingMemberRow,
			values,
		);
		const backfilledFields = Object.keys(patch);

		if (backfilledFields.length > 0) {
			await db.update(members).set(patch).where(eq(members.id, existing.id));
		}

		return { outcome: "updated", memberId: existing.id, backfilledFields };
	}

	// NEEDS_REVIEW — stage it, touch nothing.
	const [reconciliation] = await db
		.insert(intakeReconciliations)
		.values({ rawPayload })
		.returning({ id: intakeReconciliations.id });

	if (!reconciliation) {
		throw new Error("Failed to record that intake submission.");
	}

	if (match.candidates.length > 0) {
		await db.insert(intakeReconciliationCandidates).values(
			match.candidates.map((candidate) => ({
				reconciliationId: reconciliation.id,
				personId: candidate.personId,
				matchReason: candidate.matchReason,
			})),
		);
	}

	return {
		outcome: "needs_review",
		reconciliationId: reconciliation.id,
		candidateCount: match.candidates.length,
	};
}
