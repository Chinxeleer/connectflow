import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { type AreaGroupStats, selectAreaGroupStats } from "./query.ts";

/**
 * Proves the aggregate against a real database: that a connect is counted by
 * its *leader's* area group, not a column of its own, and that an area group
 * nobody has been assigned to yet still comes back at zero rather than
 * missing from the result.
 *
 * The aggregate is deliberately org-wide (see `query.ts`), so this cannot
 * assert absolute counts against a shared dev database — other rows may
 * already sit in these area groups. It asserts the *change* the fixture
 * causes instead.
 */
const TAG = `__areastatstest_${Date.now()}`;
const named = (label: string) => `${TAG}_${label}`;

const countFor = (
	stats: AreaGroupStats[],
	group: AreaGroupStats["areaGroup"],
) => stats.find((row) => row.areaGroup === group);

const createdIds: string[] = [];

describe.skipIf(!process.env.DATABASE_URL)(
	"selectAreaGroupStats (database)",
	{ retry: 2 },
	() => {
		afterAll(async () => {
			await db.delete(members).where(inArray(members.id, createdIds));
		});

		it("counts a connect against its leader's area, not its members'", async () => {
			const before = await selectAreaGroupStats();

			const [leader] = await db
				.insert(members)
				.values([{ name: named("Grace"), areaGroup: "parktown_east" }])
				.returning({ id: members.id });
			const leaderId = leader?.id ?? "";

			const [report] = await db
				.insert(members)
				.values([{ name: named("Ada"), areaGroup: "main_central", leaderId }])
				.returning({ id: members.id });
			createdIds.push(leaderId, report?.id ?? "");

			const after = await selectAreaGroupStats();

			// Grace leads a connect and stays in Parktown East, even though the
			// member she leads stays in Main (Central).
			expect(countFor(after, "parktown_east")?.connectCount).toBe(
				(countFor(before, "parktown_east")?.connectCount ?? 0) + 1,
			);
			expect(countFor(after, "parktown_east")?.memberCount).toBe(
				(countFor(before, "parktown_east")?.memberCount ?? 0) + 1,
			);
			expect(countFor(after, "main_central")?.memberCount).toBe(
				(countFor(before, "main_central")?.memberCount ?? 0) + 1,
			);
			// Ada reports to someone but leads nobody, so she adds no connect.
			expect(countFor(after, "main_central")?.connectCount).toBe(
				countFor(before, "main_central")?.connectCount ?? 0,
			);
		});

		it("still returns an area group nobody has just been assigned to", async () => {
			const stats = await selectAreaGroupStats();

			expect(stats).toHaveLength(5);
			expect(stats.map((row) => row.areaGroup)).toEqual(
				expect.arrayContaining([
					"main_central",
					"parktown_east",
					"parktown_west",
					"braamfontein_east",
					"braamfontein_west",
				]),
			);
		});
	},
);
