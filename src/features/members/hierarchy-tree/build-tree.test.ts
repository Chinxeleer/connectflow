import { describe, expect, it } from "vitest";
import { buildTree, type HierarchyRow } from "./build-tree.ts";

const row = (
	partial: Partial<HierarchyRow> & { id: string },
): HierarchyRow => ({
	name: partial.id,
	status: "assigned",
	leader_id: null,
	parent_id: null,
	depth: 1,
	has_children: false,
	...partial,
});

describe("buildTree", () => {
	it("returns an empty array for no rows", () => {
		expect(buildTree([])).toEqual([]);
	});

	it("nests a child under the node the walk reached it from", () => {
		const tree = buildTree([
			row({ id: "grace", has_children: true }),
			row({ id: "ada", leader_id: "grace", parent_id: "grace", depth: 2 }),
		]);

		expect(tree).toHaveLength(1);
		expect(tree[0]?.id).toBe("grace");
		expect(tree[0]?.children.map((node) => node.id)).toEqual(["ada"]);
	});

	it("nests a three-deep chain", () => {
		const tree = buildTree([
			row({ id: "grace", has_children: true }),
			row({
				id: "katherine",
				leader_id: "grace",
				parent_id: "grace",
				depth: 2,
				has_children: true,
			}),
			row({
				id: "mary",
				leader_id: "katherine",
				parent_id: "katherine",
				depth: 3,
			}),
		]);

		expect(tree[0]?.children[0]?.children[0]?.id).toBe("mary");
	});

	it("builds several independent roots from a flat list", () => {
		const tree = buildTree([
			row({ id: "grace" }),
			row({ id: "katherine" }),
			row({ id: "unassigned" }),
		]);

		expect(tree.map((node) => node.id)).toEqual([
			"grace",
			"katherine",
			"unassigned",
		]);
	});

	it("roots an anchor even though it names a leader above it", () => {
		// A leader's own row has a leader; the walk simply started below them.
		const tree = buildTree([
			row({ id: "grace", leader_id: "someone-above", parent_id: null }),
		]);

		expect(tree.map((node) => node.id)).toEqual(["grace"]);
	});

	it("keeps the order the query produced, rather than re-sorting", () => {
		const tree = buildTree([
			row({ id: "grace", has_children: true }),
			row({ id: "ada", name: "Ada", parent_id: "grace", depth: 2 }),
			row({ id: "alan", name: "Alan", parent_id: "grace", depth: 2 }),
		]);

		expect(tree[0]?.children.map((node) => node.name)).toEqual(["Ada", "Alan"]);
	});

	it("emits a member once when they arrive both as an anchor and as a descendant", () => {
		// A leader linked to two member rows, one sitting under the other.
		const tree = buildTree([
			row({ id: "grace", has_children: true }),
			row({ id: "katherine", leader_id: "grace", has_children: true }),
			row({
				id: "katherine",
				leader_id: "grace",
				parent_id: "grace",
				depth: 2,
				has_children: true,
			}),
			row({
				id: "mary",
				leader_id: "katherine",
				parent_id: "katherine",
				depth: 3,
			}),
		]);

		expect(tree.map((node) => node.id)).toEqual(["grace"]);
		expect(tree[0]?.children.map((node) => node.id)).toEqual(["katherine"]);
		expect(tree[0]?.children[0]?.children.map((node) => node.id)).toEqual([
			"mary",
		]);
	});

	it("keeps two members who lead each other in the tree, rather than losing both", () => {
		// leader_id points both ways here. Filing by it would make each the
		// other's child, leaving no root and dropping the pair from the page.
		const tree = buildTree([
			row({
				id: "ada",
				leader_id: "katherine",
				parent_id: null,
				has_children: true,
			}),
			row({
				id: "katherine",
				leader_id: "ada",
				parent_id: "ada",
				depth: 2,
				has_children: true,
			}),
		]);

		expect(tree.map((node) => node.id)).toEqual(["ada"]);
		expect(tree[0]?.children.map((node) => node.id)).toEqual(["katherine"]);
	});

	it("makes a member recorded as their own leader a root, never their own child", () => {
		// Nesting this node under itself renders until the stack gives out.
		const tree = buildTree([
			row({ id: "grace", leader_id: "grace", parent_id: "grace" }),
		]);

		expect(tree.map((node) => node.id)).toEqual(["grace"]);
		expect(tree[0]?.children).toEqual([]);
	});

	it("marks a node with children the walk did not return as truncated", () => {
		const tree = buildTree([row({ id: "grace", has_children: true })]);

		expect(tree[0]?.truncated).toBe(true);
	});

	it("does not mark a childless node as truncated", () => {
		const tree = buildTree([row({ id: "ada", has_children: false })]);

		expect(tree[0]?.truncated).toBe(false);
	});

	it("does not mark a node as truncated when its children are present", () => {
		const tree = buildTree([
			row({ id: "grace", has_children: true }),
			row({ id: "ada", parent_id: "grace", depth: 2 }),
		]);

		expect(tree[0]?.truncated).toBe(false);
	});
});
