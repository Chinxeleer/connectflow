import { and, asc, eq, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { type MemberScope, memberScopeWhere } from "../scope.ts";

const leader = alias(members, "leader");

/**
 * True when any row names this member as its leader. Drives the "Leader" badge,
 * which describes tree position — not the account's admin/leader access level.
 */
const hasReports = sql<boolean>`exists (
	select 1 from ${members} as report where report.leader_id = ${members}.id
)`.mapWith(Boolean);

/**
 * Null profile fields are the normal state for an imported row, until the
 * member backfills them. Surfaced as a quiet badge, not an error.
 */
const profileIncomplete = sql<boolean>`(
	${members.gender} is null
	or ${members.residence} is null
	or ${members.fieldOfStudy} is null
)`.mapWith(Boolean);

/**
 * Members visible to the caller. Scoping is applied in SQL — never fetch the
 * table and filter in the component, or a leader's response body carries every
 * other leader's people.
 *
 * `extraWhere` ANDs in a further predicate on top of the scope — used by the
 * per-area page to reuse this query and its `hasReports`/`profileIncomplete`
 * subqueries rather than a second, easily-drifting copy of them.
 */
export function selectMembers(scope: MemberScope, extraWhere?: SQL) {
	const scopeWhere = memberScopeWhere(scope);
	const where = extraWhere
		? scopeWhere
			? and(scopeWhere, extraWhere)
			: extraWhere
		: scopeWhere;

	const query = db
		.select({
			id: members.id,
			name: members.name,
			leaderId: members.leaderId,
			leaderName: leader.name,
			status: members.status,
			hasReports,
			profileIncomplete,
			createdAt: members.createdAt,
		})
		.from(members)
		.leftJoin(leader, eq(members.leaderId, leader.id))
		.orderBy(asc(members.name));

	return where ? query.where(where) : query;
}

export type MemberListRow = Awaited<ReturnType<typeof selectMembers>>[number];
