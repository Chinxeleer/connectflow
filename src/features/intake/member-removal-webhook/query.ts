import { eq, isNull } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { pendingRemovals } from "@/db/schema/pending-removals.ts";
import type { NameCandidate } from "./match.ts";

/**
 * Everyone eligible to be matched against a removal request. Excludes
 * already-removed members: matching one of them again is not a valid outcome
 * either way, so it is treated the same as zero matches and routed to
 * `pending_removals` for a human to look at, rather than silently re-running
 * (or erroring on) a removal that already happened.
 */
export async function selectRemovalCandidates(): Promise<NameCandidate[]> {
	return db
		.select({ id: members.id, name: members.name })
		.from(members)
		.where(isNull(members.removedAt));
}

export async function softDeleteMember(memberId: string): Promise<void> {
	await db
		.update(members)
		.set({ status: "inactive", removedAt: new Date() })
		.where(eq(members.id, memberId));
}

export async function insertPendingRemoval(values: {
	firstName: string;
	surname: string;
	submittedAt: Date;
}): Promise<{ id: string }> {
	const [row] = await db
		.insert(pendingRemovals)
		.values(values)
		.returning({ id: pendingRemovals.id });

	if (!row) throw new Error("Failed to record that removal request.");
	return row;
}
