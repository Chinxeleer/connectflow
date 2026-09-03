import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, CornerDownRight, UserRound } from "lucide-react";
import { MemberStatusBadge } from "@/components/shared/status-badge.tsx";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx";
import { hierarchyQueryOptions } from "./action.ts";
import type { HierarchyNode } from "./build-tree.ts";

/** Indentation per level. One number, so the chevron column stays aligned. */
const INDENT = 20;

function indent(depth: number) {
	return { paddingLeft: `${depth * INDENT + 8}px` };
}

function NodeRow({ node, depth }: { node: HierarchyNode; depth: number }) {
	const count = node.children.length;

	return (
		<div
			className="flex items-center gap-2 rounded-md py-1.5 pr-2 hover:bg-muted/50"
			style={indent(depth)}
		>
			{node.children.length > 0 ? (
				<CollapsibleTrigger
					className="text-muted-foreground hover:text-foreground flex size-6 shrink-0 items-center justify-center rounded transition-colors"
					aria-label={`Expand ${node.name}`}
				>
					<ChevronRight className="size-4 transition-transform duration-200 group-data-[state=open]/node:rotate-90" />
				</CollapsibleTrigger>
			) : (
				// Keeps names aligned with their expandable siblings.
				<span className="size-6 shrink-0" aria-hidden="true" />
			)}

			<UserRound className="text-muted-foreground size-4 shrink-0" />

			<Link
				to="/members/$memberId"
				params={{ memberId: node.id }}
				className="font-medium underline-offset-4 hover:underline"
			>
				{node.name}
			</Link>

			<MemberStatusBadge status={node.status} />

			{count > 0 ? (
				<span className="text-muted-foreground text-xs tabular-nums">
					{count} {count === 1 ? "member" : "members"}
				</span>
			) : null}
		</div>
	);
}

function TreeItem({ node, depth }: { node: HierarchyNode; depth: number }) {
	const truncatedNote = node.truncated ? (
		<div
			className="text-muted-foreground flex items-center gap-2 py-1 text-xs italic"
			style={indent(depth + 1)}
		>
			<CornerDownRight className="size-3.5" />
			More below — not shown at this depth.
		</div>
	) : null;

	if (node.children.length === 0) {
		return (
			<li>
				<NodeRow node={node} depth={depth} />
				{truncatedNote}
			</li>
		);
	}

	return (
		<li>
			{/* Roots open, deeper levels closed, so a large tree does not render
			    all at once. Uncontrolled, so toggling a sibling keeps state. */}
			<Collapsible defaultOpen={depth === 0} className="group/node">
				<NodeRow node={node} depth={depth} />
				<CollapsibleContent>
					<ul>
						{node.children.map((child) => (
							<TreeItem key={child.id} node={child} depth={depth + 1} />
						))}
					</ul>
				</CollapsibleContent>
			</Collapsible>
		</li>
	);
}

/**
 * The connect tree, already scoped by the server: an admin's response carries
 * every connect, a leader's carries only their own branch. Nothing here
 * re-filters.
 */
export function HierarchyTree() {
	const { data } = useSuspenseQuery(hierarchyQueryOptions);

	if (data.roots.length === 0) {
		return (
			<div className="rounded-lg border border-dashed p-8 text-center">
				<p className="text-muted-foreground text-sm">
					{data.scopeKind === "all"
						? "No members yet. Add one or import the connect database to see the tree."
						: data.linkedRows === 0
							? "Your account is not linked to a member record yet, so there is no connect to show. Ask an admin to link it."
							: "Nobody reports to you yet, so there is no connect to show."}
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			{data.unreachable && data.unreachable > 0 ? (
				<p className="text-muted-foreground text-xs">
					{data.unreachable}{" "}
					{data.unreachable === 1 ? "member is" : "members are"} not shown here:
					they sit below the display depth, or a leader assignment loops back on
					itself.
				</p>
			) : null}

			<div className="overflow-hidden rounded-lg border p-2">
				<ul>
					{data.roots.map((node) => (
						<TreeItem key={node.id} node={node} depth={0} />
					))}
				</ul>
			</div>
		</div>
	);
}
