import { count, sql } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import {
	hierarchyRootsWhere,
	MAX_HIERARCHY_DEPTH,
	type MemberScope,
} from "../scope.ts";
import {
	buildTree,
	type HierarchyNode,
	type HierarchyRow,
} from "./build-tree.ts";

export type HierarchyResult = {
	roots: HierarchyNode[];
	/**
	 * Members the walk never reached — stranded below the depth cap, or caught
	 * in a leadership loop. Only meaningful for an admin: for a leader,
	 * "outside my downline" is the normal case, not an anomaly, so it is null.
	 */
	unreachable: number | null;
	/** Lets the empty state say *why* it is empty rather than guessing. */
	scopeKind: MemberScope["kind"];
	linkedRows: number;
};

/**
 * The connect tree the caller may see, nested.
 *
 * An admin's walk is anchored on the members with no leader; a leader's is
 * anchored on their own member rows. Unlike the members list, this one *is*
 * recursive — the point of the page is the shape of the whole branch — but it
 * still cannot reach above or outside its anchors, so a leader sees their own
 * downline and nothing else.
 *
 * Two guards keep the recursion honest, and both are load-bearing:
 *
 *   `child.id = any(parent.path)` flags a member already seen on the way down.
 *   `leaderId` is guarded only by a `restrict` foreign key, which prevents
 *   deletion, not a loop — `A -> B -> A` is storable. The flagged row is not
 *   recursed through and not returned, so a loop ends the walk instead of
 *   running forever.
 *
 *   `parent.depth < MAX_HIERARCHY_DEPTH` bounds the cost and the depth the tree
 *   component recurses to. A member whose children sit past it comes back with
 *   `has_children` true and no children, which `buildTree` reports as truncated
 *   rather than silently understating the connect.
 *
 * Note a loop is unreachable from `leader_id is null`, so for an admin it shows
 * up as *missing* members rather than a hang. `unreachable` is what surfaces
 * them.
 */
export async function selectHierarchy(
	scope: MemberScope,
): Promise<HierarchyResult> {
	const linkedRows = scope.kind === "all" ? 0 : scope.memberIds.length;

	// A leader linked to no member row anchors nowhere. Same fail-closed answer
	// their member list gives, without a pointless round trip.
	if (scope.kind === "leaderOf" && scope.memberIds.length === 0) {
		return { roots: [], unreachable: null, scopeKind: scope.kind, linkedRows };
	}

	const result = await db.execute<HierarchyRow>(sql`
		with recursive tree as (
			select
				id,
				name,
				status,
				leader_id,
				null::uuid as parent_id,
				1 as depth,
				array[id] as path,
				false as looped
			from ${members}
			where ${hierarchyRootsWhere(scope)}

			union all

			select
				child.id,
				child.name,
				child.status,
				child.leader_id,
				parent.id as parent_id,
				parent.depth + 1,
				parent.path || child.id,
				child.id = any(parent.path)
			from ${members} as child
			join tree as parent on child.leader_id = parent.id
			where parent.looped = false
			  and parent.depth < ${MAX_HIERARCHY_DEPTH}
		)
		select
			tree.id,
			tree.name,
			tree.status,
			tree.leader_id,
			tree.parent_id,
			tree.depth,
			exists (
				select 1 from ${members} as report where report.leader_id = tree.id
			) as has_children
		from tree
		where tree.looped = false
		order by tree.depth asc, lower(tree.name) asc
	`);

	const rows = result.rows;
	const roots = buildTree(rows);

	if (scope.kind !== "all") {
		return { roots, unreachable: null, scopeKind: scope.kind, linkedRows };
	}

	const [totals] = await db.select({ value: count() }).from(members);
	const reached = new Set(rows.map((row) => row.id)).size;

	return {
		roots,
		unreachable: Math.max((totals?.value ?? 0) - reached, 0),
		scopeKind: scope.kind,
		linkedRows,
	};
}
