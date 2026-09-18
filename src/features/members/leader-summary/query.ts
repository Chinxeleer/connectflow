import { and, asc, count, desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { type MemberScope, memberScopeWithSelfWhere } from "../scope.ts";

const report = alias(members, "report");

/**
 * Everyone who leads a connect, with how many people sit under them.
 *
 * Counts **direct** reports only — a sub-leader's own people are not rolled up,
 * because the number that matters for capacity is how many this person is
 * personally carrying.
 *
 * The inner join is what restricts this to actual leaders: a member nobody
 * reports to produces no rows and so never appears. `isOrganization` rows
 * (e.g. "ENC") are excluded too — they aren't a person leading a connect,
 * however many people report to them structurally.
 */
export function selectConnectLeaders(scope: MemberScope) {
	const scopeWhere = memberScopeWithSelfWhere(scope);
	const notOrganization = eq(members.isOrganization, false);
	const where = scopeWhere ? and(scopeWhere, notOrganization) : notOrganization;

	return db
		.select({
			id: members.id,
			name: members.name,
			status: members.status,
			ministry: members.ministry,
			directMembers: count(report.id),
		})
		.from(members)
		.innerJoin(report, eq(report.leaderId, members.id))
		.where(where)
		.groupBy(members.id, members.name, members.status, members.ministry)
		.orderBy(desc(count(report.id)), asc(members.name));
}

export type ConnectLeaderRow = Awaited<
	ReturnType<typeof selectConnectLeaders>
>[number];
