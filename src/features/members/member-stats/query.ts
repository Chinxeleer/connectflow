import { count, isNull, sql } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { type MemberScope, memberScopeWhere } from "../scope.ts";

export type MemberStats = {
	total: number;
	withoutConnect: number;
	leadingAGroup: number;
	notLeadingAConnect: number;
};

/**
 * Headline counts for the members page, computed in one round trip.
 *
 * The scope predicate is applied once, as the query's `where`; every `filter`
 * then aggregates only over rows already in scope. Deliberately not "count the
 * whole table and filter in the card": a leader's stats must describe their own
 * group, or the totals leak the size of everyone else's.
 *
 * Two different questions, easily confused:
 *   `withoutConnect`      — nobody leads *them* (`leaderId` is null)
 *   `notLeadingAConnect`  — *they* lead nobody (no rows point at them)
 *
 * `leadingAGroup` and `notLeadingAConnect` partition the scope between them.
 * Both count members *in scope*; the report itself is intentionally not scoped,
 * since the question is whether this member leads anyone at all, not how many
 * of their people the caller may see.
 */
export async function selectMemberStats(
	scope: MemberScope,
): Promise<MemberStats> {
	const scoped = memberScopeWhere(scope);

	// `${members}.id`, not `${members.id}`: drizzle renders a bare column
	// reference inside a raw template as `"id"`, which the subquery then
	// resolves against *its own* table — silently comparing
	// `report.leader_id = report.id` and counting nothing.
	const leadsSomeone = sql`exists (
		select 1 from ${members} as report where report.leader_id = ${members}.id
	)`;

	const query = db
		.select({
			total: count(),
			withoutConnect: sql<number>`count(*) filter (where ${isNull(
				members.leaderId,
			)})`.mapWith(Number),
			leadingAGroup:
				sql<number>`count(*) filter (where ${leadsSomeone})`.mapWith(Number),
			notLeadingAConnect:
				sql<number>`count(*) filter (where not ${leadsSomeone})`.mapWith(
					Number,
				),
		})
		.from(members);

	const [row] = await (scoped ? query.where(scoped) : query);

	return (
		row ?? {
			total: 0,
			withoutConnect: 0,
			leadingAGroup: 0,
			notLeadingAConnect: 0,
		}
	);
}
