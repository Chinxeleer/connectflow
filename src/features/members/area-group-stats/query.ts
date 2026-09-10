import { count, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { type AreaGroup, areaGroup, members } from "@/db/schema/members.ts";

export type AreaGroupStats = {
	areaGroup: AreaGroup;
	memberCount: number;
	connectCount: number;
};

type AreaGroupRow = {
	areaGroup: AreaGroup;
	memberCount: number;
	connectCount: number;
};

/**
 * Every area group, in the fixed order the enum declares them, even one with
 * no members and no connects yet — a stats view that silently drops a group
 * because nobody has been assigned to it yet is worse than one showing zeros.
 */
export function fillAreaGroupStats(
	rows: ReadonlyArray<AreaGroupRow>,
): AreaGroupStats[] {
	const byGroup = new Map(rows.map((row) => [row.areaGroup, row]));

	return areaGroup.enumValues.map((group) => {
		const row = byGroup.get(group);
		return {
			areaGroup: group,
			memberCount: row?.memberCount ?? 0,
			connectCount: row?.connectCount ?? 0,
		};
	});
}

/**
 * People and connects per area group, org-wide.
 *
 * A connect has no row of its own — it is a member with at least one direct
 * report — so "connects in an area" counts leaders whose *own* `areaGroup`
 * matches, not something stored on a separate table. This is deliberately
 * unscoped: it is a cross-membership aggregate, so the caller (`action.ts`)
 * must gate it to an admin before calling in.
 */
export async function selectAreaGroupStats(): Promise<AreaGroupStats[]> {
	// `${members}.id`, not `${members.id}`: drizzle renders a bare column
	// reference inside a raw template as `"id"`, which the subquery then
	// resolves against its own table and silently matches nothing.
	const directReports = sql<number>`(
		select count(*) from ${members} as report
		where report.leader_id = ${members}.id
	)`;

	const rows = await db
		.select({
			areaGroup: members.areaGroup,
			memberCount: count(),
			connectCount:
				sql<number>`count(*) filter (where ${directReports} > 0)`.mapWith(
					Number,
				),
		})
		.from(members)
		.where(isNotNull(members.areaGroup))
		.groupBy(members.areaGroup);

	return fillAreaGroupStats(
		rows.filter((row): row is AreaGroupRow => row.areaGroup !== null),
	);
}
