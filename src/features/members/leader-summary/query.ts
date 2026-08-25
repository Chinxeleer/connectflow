import { asc, count, desc, eq } from "drizzle-orm";
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
 * reports to produces no rows and so never appears.
 */
export function selectConnectLeaders(scope: MemberScope) {
	const where = memberScopeWithSelfWhere(scope);

	const query = db
		.select({
			id: members.id,
			name: members.name,
			status: members.status,
			directMembers: count(report.id),
		})
		.from(members)
		.innerJoin(report, eq(report.leaderId, members.id))
		.groupBy(members.id, members.name, members.status)
		.orderBy(desc(count(report.id)), asc(members.name));

	return where ? query.where(where) : query;
}

export type ConnectLeaderRow = Awaited<
	ReturnType<typeof selectConnectLeaders>
>[number];
