import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { selectNotLeadingOverview } from "./query.ts";

/**
 * Proves the "not leading a connect" split against a real database: the
 * headline count, and how it partitions between "no leader either" and "has
 * a leader, just not leading yet" — the two subsets have to add back up to
 * the headline.
 */
const TAG = `__notleadingtest_${Date.now()}`;
const named = (label: string) => `${TAG} ${label}`;

let leaderId = "";
let assignedNotLeadingId = "";
let isolatedId = "";
let createdIds: string[] = [];

describe.skipIf(!process.env.DATABASE_URL)(
	"selectNotLeadingOverview (database)",
	{ retry: 2 },
	() => {
		beforeAll(async () => {
			const [leader] = await db
				.insert(members)
				.values({ name: named("Leader") })
				.returning({ id: members.id });
			leaderId = leader?.id ?? "";

			const [assignedNotLeading, isolated] = await db
				.insert(members)
				.values([
					{ name: named("Assigned Not Leading"), leaderId },
					{ name: named("Isolated") },
				])
				.returning({ id: members.id });
			assignedNotLeadingId = assignedNotLeading?.id ?? "";
			isolatedId = isolated?.id ?? "";

			createdIds = [leaderId, assignedNotLeadingId, isolatedId];
		});

		afterAll(async () => {
			await db
				.update(members)
				.set({ leaderId: null })
				.where(inArray(members.id, createdIds));
			await db.delete(members).where(inArray(members.id, createdIds));
		});

		it("counts a leader (leads someone) out of notLeadingAConnect", async () => {
			// Scoped to this fixture's own leader, whose only report is the
			// "assigned not leading" member — isolates the count to what this
			// test controls, since `{ kind: "all" }` would include the whole
			// shared dev database.
			const overview = await selectNotLeadingOverview({
				kind: "leaderOf",
				memberIds: [leaderId],
			});
			expect(overview.totalMembers).toBe(1);
			expect(overview.notLeadingAConnect).toBe(1);
			expect(overview.assignedToALeader).toBe(1);
			expect(overview.withoutALeaderToo).toBe(0);
		});

		it("splits notLeadingAConnect between assigned and without-a-leader-too", async () => {
			// Both fixtures sit inside the global scope alongside the whole
			// shared dev database, so assert the arithmetic invariant rather
			// than exact counts: the two subsets always sum to the headline.
			const overview = await selectNotLeadingOverview({ kind: "all" });
			expect(overview.assignedToALeader + overview.withoutALeaderToo).toBe(
				overview.notLeadingAConnect,
			);
		});
	},
);
