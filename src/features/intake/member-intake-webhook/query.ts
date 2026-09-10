import { eq, isNull } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { insertMember } from "@/features/members/create-member/index.ts";
import {
	buildIntakeBackfillPatch,
	type ExistingMemberFields,
} from "./backfill.ts";
import { findFullNameMatches } from "./match.ts";
import type { MemberIntakeValues } from "./schema.ts";

export type MemberIntakeResult = {
	id: string;
	created: boolean;
	/** Only meaningful when `created` is false — were there missing fields to fill in? */
	backfilledFields: string[];
	/** How the existing member was found, for the audit log. Absent when created. */
	matchedBy?: "email" | "name";
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

async function backfillExisting(
	existing: ExistingMemberRow,
	values: MemberIntakeValues,
	matchedBy: "email" | "name",
): Promise<MemberIntakeResult> {
	const patch = buildIntakeBackfillPatch(existing, values);
	const backfilledFields = Object.keys(patch);

	if (backfilledFields.length > 0) {
		await db.update(members).set(patch).where(eq(members.id, existing.id));
	}

	return { id: existing.id, created: false, backfilledFields, matchedBy };
}

/**
 * Creates a member from a form submission, or backfills one that already
 * exists. Two ways to find that existing member, tried in order:
 *
 * 1. Exact email match — the precise identifier, when the form gave one.
 * 2. Full-name match (case/whitespace-insensitive, `findFullNameMatches`),
 *    but *only* against members with no email on file. Many existing rows
 *    (CSV imports especially) were never given one, so email-only matching
 *    could never find them; name is the identifier that's actually reliable
 *    for them. Restricting this to email-less members means a name
 *    coincidence can never overwrite someone who has already been
 *    identified by email — only an "unclaimed" record is up for grabs by
 *    name.
 *
 * An ambiguous name match (several email-less members share a name) is
 * treated the same as no match at all: a new member is created rather than
 * guessing which one the form meant. This never loses data — the ambiguity
 * just means two rows exist until a human reconciles them — which is the
 * safe direction to fail in, unlike guessing wrong and silently attaching a
 * stranger's answers to someone else's profile.
 *
 * A repeat submission only fills in whatever the member row doesn't have an
 * answer for yet (`buildIntakeBackfillPatch`); it never overwrites data
 * that's already there, name included. A new member lands with no connect
 * leader (so they surface in the "Without a Connect" bucket, same as any
 * other unassigned member) and status "new", the same landing state a CSV
 * import row gets.
 */
export async function upsertMemberFromIntake(
	values: MemberIntakeValues,
): Promise<MemberIntakeResult> {
	if (values.email) {
		const [existing] = await db
			.select(existingMemberColumns)
			.from(members)
			.where(eq(members.email, values.email));

		if (existing) {
			return backfillExisting(existing, values, "email");
		}
	}

	const unclaimed = await db
		.select(existingMemberColumns)
		.from(members)
		.where(isNull(members.email));

	const nameMatches = findFullNameMatches(unclaimed, values.fullName);
	if (nameMatches.length === 1) {
		// biome-ignore lint/style/noNonNullAssertion: length === 1 by the check above
		return backfillExisting(nameMatches[0]!, values, "name");
	}

	const created = await insertMember({
		name: values.fullName,
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

	return { id: created.id, created: true, backfilledFields: [] };
}
