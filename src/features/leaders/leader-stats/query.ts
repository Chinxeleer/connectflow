import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import {
	type MemberScope,
	memberScopeWithSelfWhere,
} from "@/features/members/scope.ts";

export type LeaderStats = {
	totalLeaders: number;
	/** No login yet, but has an email on file — a "send access" button can act on them. */
	withoutAccess: number;
	/** No login yet, and no email on file either — can't be granted access by email alone. */
	missingEmail: number;
};

/**
 * Headline numbers for the leaders page — same "leads at least one person"
 * predicate and scope as `leader-summary`'s table, so the count above the
 * table always matches what's actually listed below it.
 */
export async function selectLeaderStats(
	scope: MemberScope,
): Promise<LeaderStats> {
	const scopeWhere = memberScopeWithSelfWhere(scope);
	const notOrganization = eq(members.isOrganization, false);
	const scoped = scopeWhere
		? and(scopeWhere, notOrganization)
		: notOrganization;

	const leadsSomeone = sql`exists (
		select 1 from ${members} as report where report.leader_id = ${members}.id
	)`;
	const noAccount = isNull(members.userId);
	const hasEmail = isNotNull(members.email);

	const [row] = await db
		.select({
			totalLeaders:
				sql<number>`count(*) filter (where ${leadsSomeone})`.mapWith(Number),
			withoutAccess:
				sql<number>`count(*) filter (where ${leadsSomeone} and ${noAccount} and ${hasEmail})`.mapWith(
					Number,
				),
			missingEmail:
				sql<number>`count(*) filter (where ${leadsSomeone} and ${noAccount} and not ${hasEmail})`.mapWith(
					Number,
				),
		})
		.from(members)
		.where(scoped);

	return row ?? { totalLeaders: 0, withoutAccess: 0, missingEmail: 0 };
}
