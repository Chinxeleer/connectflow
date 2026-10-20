import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import {
	type MemberScope,
	memberScopeWithSelfWhere,
} from "@/features/members/scope.ts";

/**
 * Leaders (leads at least one person) in scope who have no login yet but do
 * have an email on file — exactly the population the "send access to
 * everyone" button on the leaders page acts on.
 */
export async function selectLeadersWithoutAccess(scope: MemberScope) {
	const scopeWhere = memberScopeWithSelfWhere(scope);
	const notOrganization = eq(members.isOrganization, false);
	const leadsSomeone = sql`exists (
		select 1 from ${members} as report where report.leader_id = ${members}.id
	)`;

	const noAccountWithEmail = and(
		leadsSomeone,
		isNull(members.userId),
		isNotNull(members.email),
	);
	const where = scopeWhere
		? and(scopeWhere, notOrganization, noAccountWithEmail)
		: and(notOrganization, noAccountWithEmail);

	return db
		.select({ id: members.id, name: members.name, email: members.email })
		.from(members)
		.where(where);
}
