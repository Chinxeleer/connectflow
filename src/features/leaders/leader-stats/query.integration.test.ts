import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { selectLeadersWithoutAccess } from "../grant-access/query.ts";
import { selectLeaderStats } from "./query.ts";

/**
 * Proves the "leads at least one person" predicate against a real database,
 * and that a leader needs both no account *and* an email on file to show up
 * in `selectLeadersWithoutAccess`.
 */
const TAG = `__leaderstatstest_${Date.now()}`;
const named = (label: string) => `${TAG} ${label}`;

let leaderWithEmailId = "";
let leaderNoEmailId = "";
let notALeaderId = "";
let createdIds: string[] = [];

describe.skipIf(!process.env.DATABASE_URL)(
	"leader access queries (database)",
	{ retry: 2 },
	() => {
		beforeAll(async () => {
			const [leaderWithEmail, leaderNoEmail, notALeader] = await db
				.insert(members)
				.values([
					{ name: named("Email Leader"), email: "email-leader@example.com" },
					{ name: named("No Email Leader"), email: null },
					{ name: named("Not A Leader") },
				])
				.returning({ id: members.id });

			leaderWithEmailId = leaderWithEmail?.id ?? "";
			leaderNoEmailId = leaderNoEmail?.id ?? "";
			notALeaderId = notALeader?.id ?? "";

			// Give each "leader" fixture exactly one report, so the "leads at
			// least one person" predicate actually picks them up.
			await db
				.update(members)
				.set({ leaderId: leaderNoEmailId })
				.where(inArray(members.id, [notALeaderId]));

			const [reportForEmailLeader] = await db
				.insert(members)
				.values({ name: named("Report"), leaderId: leaderWithEmailId })
				.returning({ id: members.id });

			createdIds = [
				leaderWithEmailId,
				leaderNoEmailId,
				notALeaderId,
				reportForEmailLeader?.id ?? "",
			];
		});

		afterAll(async () => {
			await db
				.update(members)
				.set({ leaderId: null })
				.where(inArray(members.id, createdIds));
			await db.delete(members).where(inArray(members.id, createdIds));
		});

		it("includes a leader without an account who has an email on file", async () => {
			const rows = await selectLeadersWithoutAccess({ kind: "all" });
			expect(rows.map((row) => row.id)).toContain(leaderWithEmailId);
		});

		it("excludes a leader without an account but with no email on file", async () => {
			const rows = await selectLeadersWithoutAccess({ kind: "all" });
			expect(rows.map((row) => row.id)).not.toContain(leaderNoEmailId);
		});

		it("excludes someone who isn't actually leading anyone", async () => {
			const rows = await selectLeadersWithoutAccess({ kind: "all" });
			expect(rows.map((row) => row.id)).not.toContain(notALeaderId);
		});

		it("the without-access and missing-email stats never exceed the total", async () => {
			// Shared dev database has real leaders too, so this asserts the
			// arithmetic invariant rather than exact fixture counts.
			const stats = await selectLeaderStats({ kind: "all" });
			expect(stats.withoutAccess + stats.missingEmail).toBeLessThanOrEqual(
				stats.totalLeaders,
			);
			expect(stats.totalLeaders).toBeGreaterThanOrEqual(2);
		});
	},
);
