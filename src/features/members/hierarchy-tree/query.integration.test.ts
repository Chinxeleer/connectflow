import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import type { Actor } from "@/lib/permissions.ts";
import {
	ancestorMemberIdsFor,
	memberScopeFor,
	wouldLoopTheTree,
} from "../scope.ts";
import type { HierarchyNode } from "./build-tree.ts";
import { selectHierarchy } from "./query.ts";

/**
 * Exercises the recursive walk against a real database.
 *
 * The cycle tests are the reason this file exists. `leaderId` is guarded only
 * by a `restrict` foreign key, which prevents deletion, not a loop — so a
 * recursive CTE without a path guard runs until the connection dies, and no
 * pure test can prove otherwise.
 *
 * Fixtures are namespaced; `afterEach` restores the base shape so a cycle test
 * cannot leak into the next one, and `afterAll` removes everything.
 */
const TAG = `__treetest_${Date.now()}`;
const named = (label: string) => `${TAG}_${label}`;

const leaderActor: Actor = { id: "user-tree-leader", role: "leader" };
const adminActor: Actor = { id: "user-tree-admin", role: "admin" };

let rootId = "";
let graceId = "";
let adaId = "";
let katherineId = "";
let maryId = "";
let createdIds: string[] = [];

/** Every id in the tree below a node, flattened. */
function idsUnder(nodes: HierarchyNode[]): string[] {
	return nodes.flatMap((node) => [node.id, ...idsUnder(node.children)]);
}

function findNode(
	nodes: HierarchyNode[],
	id: string,
): HierarchyNode | undefined {
	for (const node of nodes) {
		if (node.id === id) return node;
		const found = findNode(node.children, id);
		if (found) return found;
	}
	return undefined;
}

// Retried for the same Neon transport flakiness as the other database suites.
describe.skipIf(!process.env.DATABASE_URL)(
	"selectHierarchy (database)",
	{ retry: 2 },
	() => {
		beforeAll(async () => {
			// Root -> Grace -> { Ada, Katherine -> Mary }
			const [root] = await db
				.insert(members)
				.values([{ name: named("Root") }])
				.returning({ id: members.id });
			rootId = root?.id ?? "";

			const [grace] = await db
				.insert(members)
				.values([{ name: named("Grace"), leaderId: rootId }])
				.returning({ id: members.id });
			graceId = grace?.id ?? "";

			const [ada, katherine] = await db
				.insert(members)
				.values([
					{ name: named("Ada"), leaderId: graceId },
					{ name: named("Katherine"), leaderId: graceId },
				])
				.returning({ id: members.id });
			adaId = ada?.id ?? "";
			katherineId = katherine?.id ?? "";

			const [mary] = await db
				.insert(members)
				.values([{ name: named("Mary"), leaderId: katherineId }])
				.returning({ id: members.id });
			maryId = mary?.id ?? "";

			createdIds = [rootId, graceId, adaId, katherineId, maryId];
		});

		afterEach(async () => {
			// Restore the base shape — the loop tests rewrite leaderId.
			await db
				.update(members)
				.set({ leaderId: null })
				.where(eq(members.id, rootId));
			await db
				.update(members)
				.set({ leaderId: rootId })
				.where(eq(members.id, graceId));
			await db
				.update(members)
				.set({ leaderId: graceId })
				.where(inArray(members.id, [adaId, katherineId]));
			await db
				.update(members)
				.set({ leaderId: katherineId })
				.where(eq(members.id, maryId));
		});

		afterAll(async () => {
			// Clear links first: leaderId is `restrict`, so a leader cannot be
			// deleted while their people still point at them.
			await db
				.update(members)
				.set({ leaderId: null })
				.where(inArray(members.id, createdIds));
			await db.delete(members).where(inArray(members.id, createdIds));
		});

		it("roots a leader's tree at their own member row", async () => {
			const result = await selectHierarchy(
				memberScopeFor(leaderActor, [graceId]),
			);

			expect(result.roots.map((node) => node.id)).toEqual([graceId]);
		});

		it("nests a sub-leader's people under them, unlike the members list", async () => {
			const result = await selectHierarchy(
				memberScopeFor(leaderActor, [graceId]),
			);
			const katherine = findNode(result.roots, katherineId);

			expect(katherine?.children.map((node) => node.id)).toEqual([maryId]);
		});

		it("includes a leader's grandchildren, not just their direct reports", async () => {
			const result = await selectHierarchy(
				memberScopeFor(leaderActor, [graceId]),
			);

			expect(idsUnder(result.roots)).toContain(maryId);
		});

		it("never reaches above a leader's own row", async () => {
			const result = await selectHierarchy(
				memberScopeFor(leaderActor, [graceId]),
			);

			expect(idsUnder(result.roots)).not.toContain(rootId);
		});

		it("gives a leader with no linked member row an empty tree, not the whole organisation", async () => {
			const result = await selectHierarchy(memberScopeFor(leaderActor, []));

			expect(result.roots).toEqual([]);
		});

		it("builds an admin's tree from the members with no leader", async () => {
			const result = await selectHierarchy(memberScopeFor(adminActor, []));
			const mine = result.roots.filter((node) => node.name.startsWith(TAG));

			expect(mine.map((node) => node.id)).toEqual([rootId]);
			expect(idsUnder(mine)).toEqual(
				expect.arrayContaining([graceId, adaId, katherineId, maryId]),
			);
		});

		it("reports a boolean for has_children and a number for depth", async () => {
			// `db.execute` returns raw driver rows; these are the two the mapper
			// depends on being parsed rather than arriving as strings.
			const result = await selectHierarchy(
				memberScopeFor(leaderActor, [graceId]),
			);

			expect(typeof result.roots[0]?.hasChildren).toBe("boolean");
			expect(result.roots[0]?.hasChildren).toBe(true);
		});

		it("terminates on a member who is their own leader", {
			timeout: 15_000,
		}, async () => {
			await db
				.update(members)
				.set({ leaderId: adaId })
				.where(eq(members.id, adaId));

			const result = await selectHierarchy(
				memberScopeFor(leaderActor, [adaId]),
			);

			expect(result.roots.map((node) => node.id)).toEqual([adaId]);
			expect(result.roots[0]?.children).toEqual([]);
		});

		it("terminates on a two-member leadership loop rather than recursing forever", {
			timeout: 15_000,
		}, async () => {
			// Ada leads Katherine, Katherine leads Ada. Storable: the restrict
			// foreign key stops deletion, not a loop.
			await db
				.update(members)
				.set({ leaderId: adaId })
				.where(eq(members.id, katherineId));
			await db
				.update(members)
				.set({ leaderId: katherineId })
				.where(eq(members.id, adaId));

			const result = await selectHierarchy(
				memberScopeFor(leaderActor, [adaId]),
			);
			const reached = idsUnder(result.roots);

			expect(reached).toContain(adaId);
			expect(reached).toContain(katherineId);
			// Each member appears once; the walk stops when it comes back round.
			expect(new Set(reached).size).toBe(reached.length);
		});

		it("counts a member the admin walk cannot reach as unreachable", {
			timeout: 15_000,
		}, async () => {
			// A loop has no member with a null leader, so no admin root reaches it.
			await db
				.update(members)
				.set({ leaderId: adaId })
				.where(eq(members.id, katherineId));
			await db
				.update(members)
				.set({ leaderId: katherineId })
				.where(eq(members.id, adaId));

			const result = await selectHierarchy(memberScopeFor(adminActor, []));

			expect(result.unreachable).toBeGreaterThan(0);
		});

		it("leaves unreachable null for a leader, for whom it means nothing", async () => {
			const result = await selectHierarchy(
				memberScopeFor(leaderActor, [graceId]),
			);

			expect(result.unreachable).toBeNull();
		});
	},
);

describe.skipIf(!process.env.DATABASE_URL)(
	"ancestorMemberIdsFor (database)",
	{ retry: 2 },
	() => {
		let topId = "";
		let middleId = "";
		let bottomId = "";
		let ids: string[] = [];

		beforeAll(async () => {
			const [top] = await db
				.insert(members)
				.values([{ name: named("Top") }])
				.returning({ id: members.id });
			topId = top?.id ?? "";

			const [middle] = await db
				.insert(members)
				.values([{ name: named("Middle"), leaderId: topId }])
				.returning({ id: members.id });
			middleId = middle?.id ?? "";

			const [bottom] = await db
				.insert(members)
				.values([{ name: named("Bottom"), leaderId: middleId }])
				.returning({ id: members.id });
			bottomId = bottom?.id ?? "";

			ids = [topId, middleId, bottomId];
		});

		afterAll(async () => {
			await db
				.update(members)
				.set({ leaderId: null })
				.where(inArray(members.id, ids));
			await db.delete(members).where(inArray(members.id, ids));
		});

		it("finds the leaders above a member, nearest first", async () => {
			expect(await ancestorMemberIdsFor(bottomId)).toEqual([middleId, topId]);
		});

		it("returns no ancestors for a member with no leader", async () => {
			expect(await ancestorMemberIdsFor(topId)).toEqual([]);
		});

		it("excludes the member themselves", async () => {
			expect(await ancestorMemberIdsFor(middleId)).not.toContain(middleId);
		});

		it("refuses a move that would put a leader under their own report", async () => {
			expect(await wouldLoopTheTree(topId, bottomId)).toBe(true);
		});

		it("refuses making a member their own leader", async () => {
			expect(await wouldLoopTheTree(topId, topId)).toBe(true);
		});

		it("allows moving a member up to their leader's leader", async () => {
			expect(await wouldLoopTheTree(bottomId, topId)).toBe(false);
		});
	},
);
