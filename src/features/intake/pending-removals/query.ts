import { desc, eq } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { user } from "@/db/schema/auth.ts";
import { pendingRemovals } from "@/db/schema/pending-removals.ts";

/**
 * Every removal request the webhook could not resolve on its own, newest
 * first. Deliberately unfiltered by status — a resolved or dismissed row
 * stays visible as a record of what happened to it, rather than
 * disappearing the moment it's handled.
 */
export async function selectPendingRemovals() {
	return db
		.select({
			id: pendingRemovals.id,
			firstName: pendingRemovals.firstName,
			surname: pendingRemovals.surname,
			submittedAt: pendingRemovals.submittedAt,
			status: pendingRemovals.status,
			resolvedAt: pendingRemovals.resolvedAt,
			resolvedByName: user.name,
			createdAt: pendingRemovals.createdAt,
		})
		.from(pendingRemovals)
		.leftJoin(user, eq(pendingRemovals.resolvedBy, user.id))
		.orderBy(desc(pendingRemovals.createdAt));
}

export type PendingRemovalRow = Awaited<
	ReturnType<typeof selectPendingRemovals>
>[number];
