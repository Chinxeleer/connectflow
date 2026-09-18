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
 * Always excludes `isOrganization` rows (e.g. "ENC", the nominal leader for a
 * leader/elder/pastor who doesn't report to anyone) — the roster is real
 * people, not the ministry acting as its own placeholder leader. A caller
 * that genuinely needs to see those too (picking who to assign as a leader)
 * wants `selectAssignablePeople`, not this.
 *
 * `extraWhere` ANDs in a further predicate on top of the scope — used by the
 * per-area page to reuse this query and its `hasReports`/`profileIncomplete`
 * subqueries rather than a second, easily-drifting copy of them.
 */
export function selectMembers(scope: MemberScope, extraWhere?: SQL) {
	const scopeWhere = memberScopeWhere(scope);
	const notOrganization = eq(members.isOrganization, false);
	const combinedScope = scopeWhere
		? and(scopeWhere, notOrganization)
		: notOrganization;
	const where = extraWhere ? and(combinedScope, extraWhere) : combinedScope;

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

/**
 * Everyone who could be picked as a leader, or as who a webhook request
 * refers to — unlike `selectMembers`, this deliberately includes
 * `isOrganization` rows, since an entity like "ENC" is a valid leader target
 * even though it's excluded from the roster itself.
 */
export function selectAssignablePeople(scope: MemberScope) {
	const scopeWhere = memberScopeWhere(scope);
	const query = db
		.select({ id: members.id, name: members.name })
		.from(members)
		.orderBy(asc(members.name));

	return scopeWhere ? query.where(scopeWhere) : query;
}

export type AssignablePerson = Awaited<
	ReturnType<typeof selectAssignablePeople>
>[number];
