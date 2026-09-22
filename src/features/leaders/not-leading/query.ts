import { and, count, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import {
	type MemberScope,
	memberScopeWhere,
} from "@/features/members/scope.ts";

export type NotLeadingOverview = {
	totalMembers: number;
	/** In scope, leads nobody — the population this whole page is about. */
	notLeadingAConnect: number;
	/** Of those, the subset with no connect leader of their own either. */
	withoutALeaderToo: number;
	/** Of those, the subset who do have a connect leader assigned. */
	assignedToALeader: number;
};

/**
 * Headline numbers for the "not leading a connect yet" page — same scope and
 * `isOrganization` exclusion as `connect-overview`/`member-stats`, so these
 * numbers mean the same thing everywhere else in the app.
 */
export async function selectNotLeadingOverview(
	scope: MemberScope,
): Promise<NotLeadingOverview> {
	const scopeWhere = memberScopeWhere(scope);
	const notOrganization = eq(members.isOrganization, false);
	const scoped = scopeWhere
		? and(scopeWhere, notOrganization)
		: notOrganization;

	// `${members}.id`, not `${members.id}` — see CLAUDE.md's drizzle raw-SQL
	// gotcha: the bare form resolves against the subquery's own table.
	const notLeading = sql`not exists (
		select 1 from ${members} as report where report.leader_id = ${members}.id
	)`;

	const [row] = await db
		.select({
			totalMembers: count(),
			notLeadingAConnect:
				sql<number>`count(*) filter (where ${notLeading})`.mapWith(Number),
			withoutALeaderToo:
				sql<number>`count(*) filter (where ${notLeading} and ${isNull(
					members.leaderId,
				)})`.mapWith(Number),
			assignedToALeader:
				sql<number>`count(*) filter (where ${notLeading} and ${members.leaderId} is not null)`.mapWith(
					Number,
				),
		})
		.from(members)
		.where(scoped);

	return (
		row ?? {
			totalMembers: 0,
			notLeadingAConnect: 0,
			withoutALeaderToo: 0,
			assignedToALeader: 0,
		}
	);
}
