import type { MemberStatus } from "@/db/schema/members.ts";

/**
 * One row as the recursive walk returns it.
 *
 * Snake-cased because these come straight off the driver — `db.execute` returns
 * raw Postgres rows, not drizzle-mapped ones, so a camelCase type here would
 * compile happily and be `undefined` at runtime.
 *
 * `parent_id` is the node this row was *reached from*, which is not the same as
 * `leader_id`: an anchor row has a leader, but no traversal parent, because the
 * walk started there. Nesting by the traversed edge is what keeps the tree a
 * tree — see `buildTree`.
 */
export type HierarchyRow = {
	id: string;
	name: string;
	status: MemberStatus;
	leader_id: string | null;
	parent_id: string | null;
	depth: number;
	has_children: boolean;
};

export type HierarchyNode = {
	id: string;
	name: string;
	status: MemberStatus;
	/** Anyone reports to this member, whether or not they are rendered below. */
	hasChildren: boolean;
	/**
	 * They have people, but the walk did not return them — the depth cap, or a
	 * leader assignment that loops. Rendered as a note rather than dropped, so
	 * the tree never quietly understates a connect.
	 */
	truncated: boolean;
	children: HierarchyNode[];
};

/**
 * Nests a flat walk into a tree.
 *
 * Pure, and separated from the query for that reason: this is where the fiddly
 * cases live, and every one of them is reachable without a database.
 *
 * Nesting follows `parent_id` — the edge the walk actually traversed — never
 * `leader_id`. With two members who lead each other, `leader_id` points both
 * ways: each would be filed under the other, and the pair would drop out of the
 * tree entirely because neither is left as a root. The traversed edge has no
 * such ambiguity, because the walk only ever reaches a node once.
 *
 * Rows arrive ordered by depth then name, so children land in name order
 * without a second sort.
 */
export function buildTree(rows: ReadonlyArray<HierarchyRow>): HierarchyNode[] {
	const nodes = new Map<string, HierarchyNode>();
	const parentOf = new Map<string, string | null>();

	// A leader may be linked to several member rows, one of them inside
	// another's subtree, so the same person arrives twice: once as an anchor
	// and once as a descendant. Prefer the parented copy, which renders them in
	// position under their leader rather than as a second root.
	for (const row of rows) {
		const seen = nodes.get(row.id);

		if (seen) {
			if (row.parent_id && !parentOf.get(row.id)) {
				parentOf.set(row.id, row.parent_id);
			}
			continue;
		}

		nodes.set(row.id, {
			id: row.id,
			name: row.name,
			status: row.status,
			hasChildren: row.has_children,
			truncated: false,
			children: [],
		});
		parentOf.set(row.id, row.parent_id);
	}

	const roots: HierarchyNode[] = [];

	for (const [id, node] of nodes) {
		const parentId = parentOf.get(id);
		const parent = parentId ? nodes.get(parentId) : undefined;

		if (parent && parent !== node) {
			parent.children.push(node);
			continue;
		}

		roots.push(node);
	}

	for (const node of nodes.values()) {
		node.truncated = node.hasChildren && node.children.length === 0;
	}

	return roots;
}
