import { and, count, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { type MemberScope, memberScopeWhere } from "../scope.ts";

export type ConnectOverview = {
	totalMembers: number;
	withoutConnect: number;
	/** Members in scope who have at least one person under them. */
	activeConnects: number;
	/** Members in scope who sit in someone's connect. */
	membersInAConnect: number;
	/** Direct members carried by the biggest connect in scope. */
	largestConnect: number;
	/** Case-insensitive match on `gender = 'female'`. */
	female: number;
	/** Case-insensitive match on `gender = 'male'`. */
	male: number;
};

/**
 * The connect structure at a glance, for the dashboard.
 *
 * Scoped exactly like the members page — an admin sees the whole system, a
 * leader sees the people directly under them — so the same number means the
 * same thing on both pages. Also excludes `isOrganization` rows (e.g. "ENC")
 * the same way the members page does — one wouldn't be a real "active
 * connect", and its reports being "in a connect" would be misleading, given
 * it exists only as a nominal leader for people who don't really report to
 * anyone.
 *
 * Deliberately not the account statistics that used to sit here: how many
 * logins exist says nothing about how the connects are doing. Those moved to
 * /users, where managing accounts actually happens.
 */
export async function selectConnectOverview(
	scope: MemberScope,
): Promise<ConnectOverview> {
	const scopeWhere = memberScopeWhere(scope);
	const notOrganization = eq(members.isOrganization, false);
	const scoped = scopeWhere
		? and(scopeWhere, notOrganization)
		: notOrganization;

	// `${members}.id`, not `${members.id}`: drizzle renders a bare column
	// reference inside a raw template as `"id"`, which the subquery then
	// resolves against its own table and silently matches nothing.
	const directReports = sql<number>`(
		select count(*) from ${members} as report
		where report.leader_id = ${members}.id
	)`;

	const query = db
		.select({
			totalMembers: count(),
			withoutConnect: sql<number>`count(*) filter (where ${isNull(
				members.leaderId,
			)})`.mapWith(Number),
			activeConnects:
				sql<number>`count(*) filter (where ${directReports} > 0)`.mapWith(
					Number,
				),
			membersInAConnect:
				sql<number>`count(*) filter (where ${members.leaderId} is not null)`.mapWith(
					Number,
				),
			largestConnect: sql<number>`coalesce(max(${directReports}), 0)`.mapWith(
				Number,
			),
			// `gender` is free text (no enum/CHECK constraint), so this matches
			// case-insensitively and leaves everything else — null, blank, or any
			// other free-text answer — out of both counts rather than guessing.
			female:
				sql<number>`count(*) filter (where lower(${members.gender}) = 'female')`.mapWith(
					Number,
				),
			male: sql<number>`count(*) filter (where lower(${members.gender}) = 'male')`.mapWith(
				Number,
			),
		})
		.from(members);

	const [row] = await query.where(scoped);

	return (
		row ?? {
			totalMembers: 0,
			withoutConnect: 0,
			activeConnects: 0,
			membersInAConnect: 0,
			largestConnect: 0,
			female: 0,
			male: 0,
		}
	);
}

/**
 * Members per connect, to one decimal. Returns 0 rather than NaN when there
 * are no connects yet — a fresh system must not render "NaN members each".
 */
export function averageConnectSize(overview: ConnectOverview): number {
	if (overview.activeConnects === 0) return 0;
	return (
		Math.round((overview.membersInAConnect / overview.activeConnects) * 10) / 10
	);
}
