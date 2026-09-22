import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { type MemberScope, memberScopeWhere } from "../scope.ts";

const leader = alias(members, "leader");

/**
 * True when any row names this member as its leader — same predicate
 * `member-list`'s `hasReports` uses, just inverted here.
 */
const notLeading = sql<boolean>`not exists (
	select 1 from ${members} as report where report.leader_id = ${members}.id
)`.mapWith(Boolean);

/**
 * The dashboard's "needs attention" list — everyone in scope who either has
 * no connect leader, isn't leading a connect themselves, or both. Scoped like
 * `connect-overview` and `member-stats` (direct reports only, viewer
 * excluded) and excluding `isOrganization` rows, so the same person never
 * shows up here just because they're the nominal placeholder leader "ENC".
 */
export function selectMembersNeedingAttention(scope: MemberScope) {
	const scopeWhere = memberScopeWhere(scope);
	const notOrganization = eq(members.isOrganization, false);
	const needsAttention = sql`(${isNull(members.leaderId)} or ${notLeading})`;
	const where = scopeWhere
		? and(scopeWhere, notOrganization, needsAttention)
		: and(notOrganization, needsAttention);

	return db
		.select({
			id: members.id,
			name: members.name,
			leaderId: members.leaderId,
			leaderName: leader.name,
			status: members.status,
			notLeading,
		})
		.from(members)
		.leftJoin(leader, eq(members.leaderId, leader.id))
		.where(where)
		.orderBy(
			desc(isNull(members.leaderId)),
			desc(notLeading),
			asc(members.name),
		);
}

export type MemberNeedingAttentionRow = Awaited<
	ReturnType<typeof selectMembersNeedingAttention>
>[number];

export type AttentionReason =
	| "no_leader_and_not_leading"
	| "no_leader"
	| "not_leading";

/**
 * Which of the two problems this row has — drives the reason badge in the
 * table. Pure so it's cheap to test without a database.
 */
export function attentionReasonFor(
	row: Pick<MemberNeedingAttentionRow, "leaderId" | "notLeading">,
): AttentionReason {
	const unassigned = row.leaderId === null;
	if (unassigned && row.notLeading) return "no_leader_and_not_leading";
	if (unassigned) return "no_leader";
	return "not_leading";
}

export const ATTENTION_REASON_LABELS: Record<AttentionReason, string> = {
	no_leader_and_not_leading: "No leader & not leading a connect",
	no_leader: "No leader assigned",
	not_leading: "Not leading a connect yet",
};
