import { count, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { type AreaGroup, members } from "@/db/schema/members.ts";

export type AreaOverview = {
	totalMembers: number;
	withoutConnect: number;
	leadingConnect: number;
	notLeadingConnect: number;
};

/**
 * The four headline numbers for one area group — the same shape of question
 * `connect-overview` answers for a leader's scope, asked with "stays in this
 * area" as the filter instead of "reports to me".
 */
export async function selectAreaOverview(
	group: AreaGroup,
): Promise<AreaOverview> {
	// `${members}.id`, not `${members.id}`: drizzle renders a bare column
	// reference inside a raw template as `"id"`, which the subquery then
	// resolves against its own table and silently matches nothing.
	const directReports = sql<number>`(
		select count(*) from ${members} as report
		where report.leader_id = ${members}.id
	)`;

	const [row] = await db
		.select({
			totalMembers: count(),
			withoutConnect: sql<number>`count(*) filter (where ${isNull(
				members.leaderId,
			)})`.mapWith(Number),
			leadingConnect:
				sql<number>`count(*) filter (where ${directReports} > 0)`.mapWith(
					Number,
				),
		})
		.from(members)
		.where(eq(members.areaGroup, group));

	const totalMembers = row?.totalMembers ?? 0;
	const leadingConnect = row?.leadingConnect ?? 0;

	return {
		totalMembers,
		withoutConnect: row?.withoutConnect ?? 0,
		leadingConnect,
		notLeadingConnect: totalMembers - leadingConnect,
	};
}
