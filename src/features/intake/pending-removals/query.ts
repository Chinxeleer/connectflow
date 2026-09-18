import { desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { user } from "@/db/schema/auth.ts";
import { members } from "@/db/schema/members.ts";
import { pendingRemovals } from "@/db/schema/pending-removals.ts";
import { matchPersonForRemoval } from "@/lib/person-matching.ts";

export type PendingRemovalCandidate = {
	id: string;
	name: string;
	matchReason: string;
};

/**
 * Every removal request the webhook could not resolve on its own, newest
 * first. Deliberately unfiltered by status — a resolved or dismissed row
 * stays visible as a record of what happened to it, rather than
 * disappearing the moment it's handled.
 *
 * Each still-pending row gets fresh candidate suggestions computed against
 * the current membership, not the membership at submission time — who's on
 * file can change between then and whenever an admin looks at this list, so
 * candidates are never persisted, only computed at read time.
 */
export async function selectPendingRemovals() {
	const [rows, candidatePool] = await Promise.all([
		db
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
			.orderBy(desc(pendingRemovals.createdAt)),
		db
			.select({ id: members.id, name: members.name })
			.from(members)
			.where(isNull(members.removedAt)),
	]);

	const nameById = new Map(candidatePool.map((m) => [m.id, m.name]));

	return rows.map((row) => {
		if (row.status !== "pending") {
			return { ...row, candidates: [] as PendingRemovalCandidate[] };
		}

		const match = matchPersonForRemoval(
			{ firstName: row.firstName, surname: row.surname },
			candidatePool,
		);
		const matched =
			match.outcome === "EXACT_MATCH"
				? [{ personId: match.personId, matchReason: "exact name match" }]
				: match.candidates;

		return {
			...row,
			candidates: matched.map((candidate) => ({
				id: candidate.personId,
				name: nameById.get(candidate.personId) ?? "Unknown member",
				matchReason: candidate.matchReason,
			})),
		};
	});
}

export type PendingRemovalRow = Awaited<
	ReturnType<typeof selectPendingRemovals>
>[number];
