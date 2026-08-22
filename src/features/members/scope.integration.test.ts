import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import type { Actor } from "@/lib/permissions.ts";
import { selectMembers } from "./member-list/query.ts";
import { selectMemberStats } from "./member-stats/query.ts";
import { memberScopeFor } from "./scope.ts";

/**
 * Exercises the scoping against a real database. The pure tests in
 * `scope.test.ts` prove the rule; these prove the SQL actually honours it,
 * which is the failure that would leak one leader's people to another.
 *
 * Fixtures are namespaced and torn down in `afterAll`.
 */
const TAG = `__scopetest_${Date.now()}`;
const named = (label: string) => `${TAG}_${label}`;

const leaderActor: Actor = { id: "user-leader", role: "leader" };

let graceId = "";
let katherineId = "";
let createdIds: string[] = [];

describe.skipIf(!process.env.DATABASE_URL)("member scoping (database)", () => {
	beforeAll(async () => {
		// Two leaders, each with their own people, plus one unassigned member.
		const [grace, katherine] = await db
			.insert(members)
			.values([{ name: named("Grace") }, { name: named("Katherine") }])
			.returning({ id: members.id });

		graceId = grace?.id ?? "";
		katherineId = katherine?.id ?? "";

		const rest = await db
			.insert(members)
			.values([
				{ name: named("Ada"), leaderId: graceId },
				{ name: named("Alan"), leaderId: graceId },
				{ name: named("Mary"), leaderId: katherineId },
				{ name: named("Unassigned") },
			])
			.returning({ id: members.id });

		createdIds = [graceId, katherineId, ...rest.map((row) => row.id)];
	});

	afterAll(async () => {
		// Clear links first: leaderId is `restrict`, so leaders cannot be
		// deleted while their people still point at them.
		await db
			.update(members)
			.set({ leaderId: null })
			.where(inArray(members.id, createdIds));
		await db.delete(members).where(inArray(members.id, createdIds));
	});

	it("an admin sees members from every group", async () => {
		const rows = await selectMembers({ kind: "all" });
		const mine = rows.filter((row) => row.name.startsWith(TAG));

		expect(mine).toHaveLength(6);
		expect(mine.map((row) => row.name).sort()).toContain(named("Mary"));
	});

	it("a leader sees only their own direct members", async () => {
		const scope = memberScopeFor(leaderActor, [graceId]);
		const rows = await selectMembers(scope);

		expect(rows.map((row) => row.name).sort()).toEqual([
			named("Ada"),
			named("Alan"),
		]);
	});

	it("a leader never sees another leader's people", async () => {
		const rows = await selectMembers(memberScopeFor(leaderActor, [graceId]));
		expect(rows.some((row) => row.name === named("Mary"))).toBe(false);
	});

	it("a leader does not see unassigned members", async () => {
		const rows = await selectMembers(memberScopeFor(leaderActor, [graceId]));
		expect(rows.some((row) => row.name === named("Unassigned"))).toBe(false);
	});

	it("a leader with no linked member row sees nothing at all", async () => {
		// The dangerous regression: an empty scope must not fall through to
		// "no filter", which would return the entire table.
		const rows = await selectMembers(memberScopeFor(leaderActor, []));
		expect(rows).toEqual([]);
	});

	it("scoping is not recursive — sub-leaders' people stay hidden", async () => {
		// Make Katherine report to Grace: Grace still must not see Mary.
		await db
			.update(members)
			.set({ leaderId: graceId })
			.where(eq(members.id, katherineId));

		const rows = await selectMembers(memberScopeFor(leaderActor, [graceId]));
		const names = rows.map((row) => row.name).sort();

		expect(names).toEqual([named("Ada"), named("Alan"), named("Katherine")]);
		expect(names).not.toContain(named("Mary"));

		await db
			.update(members)
			.set({ leaderId: null })
			.where(eq(members.id, katherineId));
	});

	it("resolves the leader name for the Connect Leader column", async () => {
		const rows = await selectMembers(memberScopeFor(leaderActor, [graceId]));
		expect(rows.every((row) => row.leaderName === named("Grace"))).toBe(true);
	});

	it("flags a member who has reports, and only them", async () => {
		const rows = await selectMembers({ kind: "all" });
		const grace = rows.find((row) => row.name === named("Grace"));
		const ada = rows.find((row) => row.name === named("Ada"));

		expect(grace?.hasReports).toBe(true);
		expect(ada?.hasReports).toBe(false);
	});

	it("marks imported rows with blank profile fields as incomplete", async () => {
		const rows = await selectMembers({ kind: "all" });
		const ada = rows.find((row) => row.name === named("Ada"));
		expect(ada?.profileIncomplete).toBe(true);
	});

	it("scopes a leader's stats to their own group", async () => {
		const stats = await selectMemberStats(
			memberScopeFor(leaderActor, [graceId]),
		);

		expect(stats.total).toBe(2);
		expect(stats.withoutConnect).toBe(0);
		expect(stats.leadingAGroup).toBe(0);
		expect(stats.notLeadingAConnect).toBe(2);
	});

	it("counts members who lead nobody, separately from unassigned members", async () => {
		// Ada and Alan have a leader but lead nobody; Grace and Katherine lead
		// people; Unassigned neither has a leader nor leads anyone. The two
		// answer different questions and must not be conflated.
		const stats = await selectMemberStats({ kind: "all" });

		expect(stats.leadingAGroup + stats.notLeadingAConnect).toBe(stats.total);
		expect(stats.notLeadingAConnect).not.toBe(stats.withoutConnect);
	});

	it("gives an unscoped leader zeroed stats, not system-wide totals", async () => {
		const stats = await selectMemberStats(memberScopeFor(leaderActor, []));
		expect(stats).toEqual({
			total: 0,
			withoutConnect: 0,
			leadingAGroup: 0,
			notLeadingAConnect: 0,
		});
	});

	it("counts unassigned members and group leaders for an admin", async () => {
		const stats = await selectMemberStats({ kind: "all" });

		expect(stats.total).toBeGreaterThanOrEqual(6);
		expect(stats.withoutConnect).toBeGreaterThanOrEqual(3);
		expect(stats.leadingAGroup).toBeGreaterThanOrEqual(2);
		expect(stats.notLeadingAConnect).toBeGreaterThanOrEqual(4);
	});
});
