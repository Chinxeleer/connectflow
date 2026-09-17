import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { user } from "@/db/schema/auth.ts";
import {
	intakeReconciliationCandidates,
	intakeReconciliations,
} from "@/db/schema/intake-reconciliations.ts";
import { members } from "@/db/schema/members.ts";

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
