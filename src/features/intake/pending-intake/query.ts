import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { user } from "@/db/schema/auth.ts";
import {
	intakeReconciliationCandidates,
	intakeReconciliations,
} from "@/db/schema/intake-reconciliations.ts";
import { members } from "@/db/schema/members.ts";
import { memberIntakeSchema } from "@/features/intake/member-intake-webhook/index.ts";
import type { IntakeFieldPatch } from "./schema.ts";

/**
 * Every intake reconciliation — `matchPerson` couldn't confidently decide
 * these on its own — newest first, with every candidate `matchPerson` found
 * and that candidate's current profile attached, so the admin resolving one
 * sees exactly what it would mean to pick them. Deliberately unfiltered by
 * status, same as `pending_removals`: a resolved row stays visible as a
 * record of what happened.
 */
export async function selectPendingIntakeReconciliations() {
	const reconciliations = await db
		.select({
			id: intakeReconciliations.id,
			rawPayload: intakeReconciliations.rawPayload,
			status: intakeReconciliations.status,
			resolution: intakeReconciliations.resolution,
			resolvedMemberId: intakeReconciliations.resolvedMemberId,
			resolvedByName: user.name,
			resolvedAt: intakeReconciliations.resolvedAt,
			createdAt: intakeReconciliations.createdAt,
		})
		.from(intakeReconciliations)
		.leftJoin(user, eq(intakeReconciliations.resolvedBy, user.id))
		.orderBy(desc(intakeReconciliations.createdAt));

	if (reconciliations.length === 0) return [];

	const reconciliationIds = reconciliations.map((r) => r.id);
	const candidateRows = await db
		.select({
			reconciliationId: intakeReconciliationCandidates.reconciliationId,
			matchReason: intakeReconciliationCandidates.matchReason,
			personId: members.id,
			name: members.name,
			phone: members.phone,
			email: members.email,
			gender: members.gender,
			residence: members.residence,
			fieldOfStudy: members.fieldOfStudy,
			areaGroup: members.areaGroup,
			yearOfStudy: members.yearOfStudy,
		})
		.from(intakeReconciliationCandidates)
		.innerJoin(members, eq(intakeReconciliationCandidates.personId, members.id))
		.where(
			inArray(
				intakeReconciliationCandidates.reconciliationId,
				reconciliationIds,
			),
		);

	const candidatesByReconciliation = new Map<string, typeof candidateRows>();
	for (const row of candidateRows) {
		const existing = candidatesByReconciliation.get(row.reconciliationId);
		if (existing) {
			existing.push(row);
		} else {
			candidatesByReconciliation.set(row.reconciliationId, [row]);
		}
	}

	return reconciliations.map((reconciliation) => ({
		...reconciliation,
		candidates: candidatesByReconciliation.get(reconciliation.id) ?? [],
	}));
}

export type PendingIntakeReconciliation = Awaited<
	ReturnType<typeof selectPendingIntakeReconciliations>
>[number];
export type IntakeReconciliationCandidateRow =
	PendingIntakeReconciliation["candidates"][number];

/**
 * Resolves a reconciliation by confirming it's the named candidate — applies
 * only the fields the caller included in `patch` (the will_add and any
 * use-new conflict fields; `name` is deliberately never part of this) and
 * marks the reconciliation resolved, atomically. The `status = 'pending'`
 * guard means a reconciliation already handled elsewhere (another admin,
 * another tab) fails the whole transaction rather than being resolved twice.
 */
export async function resolveReconciliationAsUpdate({
	reconciliationId,
	personId,
	patch,
	actorId,
}: {
	reconciliationId: string;
	personId: string;
	patch: IntakeFieldPatch;
	actorId: string;
}): Promise<void> {
	await db.transaction(async (tx) => {
		if (Object.keys(patch).length > 0) {
			await tx.update(members).set(patch).where(eq(members.id, personId));
		}

		const [updated] = await tx
			.update(intakeReconciliations)
			.set({
				status: "resolved",
				resolution: "updated_existing",
				resolvedMemberId: personId,
				resolvedBy: actorId,
				resolvedAt: new Date(),
			})
			.where(
				and(
					eq(intakeReconciliations.id, reconciliationId),
					eq(intakeReconciliations.status, "pending"),
				),
			)
			.returning({ id: intakeReconciliations.id });

		if (!updated) {
			throw new Error("That submission has already been handled.");
		}
	});
}

/**
 * Resolves a reconciliation by creating a genuinely new person from the
 * original submission — re-validated through the same schema the webhook
 * itself used, since it's guaranteed to have already passed it once.
 */
export async function resolveReconciliationAsNew({
	reconciliationId,
	actorId,
}: {
	reconciliationId: string;
	actorId: string;
}): Promise<{ memberId: string }> {
	const [reconciliation] = await db
		.select({ rawPayload: intakeReconciliations.rawPayload })
		.from(intakeReconciliations)
		.where(
			and(
				eq(intakeReconciliations.id, reconciliationId),
				eq(intakeReconciliations.status, "pending"),
			),
		);

	if (!reconciliation) {
		throw new Error("That submission has already been handled.");
	}

	const values = memberIntakeSchema.parse(reconciliation.rawPayload);

	return db.transaction(async (tx) => {
		const [created] = await tx
			.insert(members)
			.values({
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
			})
			.returning({ id: members.id });

		if (!created) throw new Error("Failed to create that member.");

		const [updated] = await tx
			.update(intakeReconciliations)
			.set({
				status: "resolved",
				resolution: "created_new",
				resolvedMemberId: created.id,
				resolvedBy: actorId,
				resolvedAt: new Date(),
			})
			.where(
				and(
					eq(intakeReconciliations.id, reconciliationId),
					eq(intakeReconciliations.status, "pending"),
				),
			)
			.returning({ id: intakeReconciliations.id });

		if (!updated) {
			throw new Error("That submission has already been handled.");
		}

		return { memberId: created.id };
	});
}

/**
 * Discards a reconciliation as not applicable — spam, a duplicate, a
 * mistaken submission. No person record touched.
 */
export async function discardReconciliation({
	reconciliationId,
	actorId,
}: {
	reconciliationId: string;
	actorId: string;
}): Promise<void> {
	const [updated] = await db
		.update(intakeReconciliations)
		.set({
			status: "resolved",
			resolution: "discarded",
			resolvedBy: actorId,
			resolvedAt: new Date(),
		})
		.where(
			and(
				eq(intakeReconciliations.id, reconciliationId),
				eq(intakeReconciliations.status, "pending"),
			),
		)
		.returning({ id: intakeReconciliations.id });

	if (!updated) {
		throw new Error("That submission has already been handled.");
	}
}
