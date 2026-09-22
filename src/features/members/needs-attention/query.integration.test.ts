import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { attentionReasonFor, selectMembersNeedingAttention } from "./query.ts";

/**
 * Proves the dashboard's "needs attention" filter against a real database —
 * specifically that it's an OR (no leader, not leading, or both), not an AND,
 * and that someone with both a leader and a connect of their own never shows
 * up at all.
 */
const TAG = `__attentiontest_${Date.now()}`;
const named = (label: string) => `${TAG} ${label}`;

let leaderAId = "";
let memberUnderAId = "";
let leaderBId = "";
let memberUnderBId = "";
let isolatedId = "";
let createdIds: string[] = [];

describe.skipIf(!process.env.DATABASE_URL)(
	"selectMembersNeedingAttention (database)",
	{ retry: 2 },
	() => {
		beforeAll(async () => {
			const [leaderA] = await db
				.insert(members)
				.values({ name: named("Leader A") })
				.returning({ id: members.id });
			leaderAId = leaderA?.id ?? "";

			const [memberUnderA, leaderB, isolated] = await db
				.insert(members)
				.values([
					{ name: named("Member Under A"), leaderId: leaderAId },
					{ name: named("Leader B"), leaderId: leaderAId },
					{ name: named("Isolated") },
				])
				.returning({ id: members.id });
			memberUnderAId = memberUnderA?.id ?? "";
			leaderBId = leaderB?.id ?? "";
			isolatedId = isolated?.id ?? "";

			const [memberUnderB] = await db
				.insert(members)
				.values({ name: named("Member Under B"), leaderId: leaderBId })
				.returning({ id: members.id });
			memberUnderBId = memberUnderB?.id ?? "";

			createdIds = [
				leaderAId,
				memberUnderAId,
				leaderBId,
				memberUnderBId,
				isolatedId,
			];
		});

		afterAll(async () => {
			await db
				.update(members)
				.set({ leaderId: null })
				.where(inArray(members.id, createdIds));
			await db.delete(members).where(inArray(members.id, createdIds));
		});

		it("flags someone leading others but with no leader of their own", async () => {
			const rows = await selectMembersNeedingAttention({ kind: "all" });
			const row = rows.find((r) => r.id === leaderAId);
			expect(row).toBeDefined();
			if (!row) throw new Error("unreachable");
			expect(attentionReasonFor(row)).toBe("no_leader");
		});

		it("flags someone with a leader who isn't leading anyone themselves", async () => {
			const rows = await selectMembersNeedingAttention({ kind: "all" });
			const row = rows.find((r) => r.id === memberUnderAId);
			expect(row).toBeDefined();
			if (!row) throw new Error("unreachable");
			expect(attentionReasonFor(row)).toBe("not_leading");
		});

		it("flags someone with neither a leader nor a connect of their own", async () => {
			const rows = await selectMembersNeedingAttention({ kind: "all" });
			const row = rows.find((r) => r.id === isolatedId);
			expect(row).toBeDefined();
			if (!row) throw new Error("unreachable");
			expect(attentionReasonFor(row)).toBe("no_leader_and_not_leading");
		});

		it("excludes someone who has both a leader and a connect of their own", async () => {
			const rows = await selectMembersNeedingAttention({ kind: "all" });
			expect(rows.map((r) => r.id)).not.toContain(leaderBId);
		});

		it("still flags a second person who has a leader but isn't leading anyone", async () => {
			const rows = await selectMembersNeedingAttention({ kind: "all" });
			const row = rows.find((r) => r.id === memberUnderBId);
			expect(row).toBeDefined();
			if (!row) throw new Error("unreachable");
			expect(attentionReasonFor(row)).toBe("not_leading");
		});
	},
);
