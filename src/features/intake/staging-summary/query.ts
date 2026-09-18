import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { intakeReconciliations } from "@/db/schema/intake-reconciliations.ts";
import { members } from "@/db/schema/members.ts";
import { pendingRemovals } from "@/db/schema/pending-removals.ts";

export type StagingAttentionCount = {
	unassigned: number;
	needsReview: number;
	removals: number;
	total: number;
};

/**
 * How many things across Staging need an admin's attention — the count
 * behind the sidebar's notification badge. Three cheap `count(*)`s rather
 * than fetching each list in full just to measure its length; the sidebar
 * mounts once per session and this runs on every one of those mounts.
 */
export async function selectStagingAttentionCount(): Promise<StagingAttentionCount> {
	const [[unassignedRow], [needsReviewRow], [removalsRow]] = await Promise.all([
		db
			.select({ count: count() })
			.from(members)
			.where(
				and(
					isNull(members.leaderId),
					isNull(members.removedAt),
					eq(members.isOrganization, false),
				),
			),
		db
			.select({ count: count() })
			.from(intakeReconciliations)
			.where(eq(intakeReconciliations.status, "pending")),
		db
			.select({ count: count() })
			.from(pendingRemovals)
			.where(eq(pendingRemovals.status, "pending")),
	]);

	const unassigned = unassignedRow?.count ?? 0;
	const needsReview = needsReviewRow?.count ?? 0;
	const removals = removalsRow?.count ?? 0;

	return {
		unassigned,
		needsReview,
		removals,
		total: unassigned + needsReview + removals,
	};
}
