import { useSuspenseQuery } from "@tanstack/react-query";
import {
	type ColumnDef,
	columnFilteringFeature,
	createFilteredRowModel,
	createSortedRowModel,
	filterFn_includesString,
	globalFilteringFeature,
	rowSortingFeature,
	type SortingState,
	sortFn_alphanumeric,
	sortFn_basic,
	sortFn_datetime,
	sortFn_text,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import { ArrowUpDown, Eye } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table.tsx";
import { ConfirmDeleteMember } from "@/features/members/delete-member/ConfirmDelete.tsx";
import { membersQueryOptions } from "./action.ts";
import type { MemberListRow } from "./query.ts";

const features = tableFeatures({
	rowSortingFeature,
	columnFilteringFeature,
	globalFilteringFeature,
	sortedRowModel: createSortedRowModel(),
	filteredRowModel: createFilteredRowModel(),
	sortFns: {
		alphanumeric: sortFn_alphanumeric,
		basic: sortFn_basic,
		text: sortFn_text,
		datetime: sortFn_datetime,
	},
	filterFns: { includesString: filterFn_includesString },
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
	new: "default",
	contacted: "secondary",
	assigned: "secondary",
	inducted: "outline",
	inactive: "outline",
};

function buildColumns(
	canDelete: boolean,
): ColumnDef<typeof features, MemberListRow>[] {
	const columns: ColumnDef<typeof features, MemberListRow>[] = [
		{
			accessorKey: "name",
			header: "Name",
			sortFn: "text",
			cell: ({ row }) => (
				<span className="font-medium">{row.original.name}</span>
			),
		},
		{
			accessorKey: "leaderName",
			header: "Connect Leader",
			sortFn: "text",
			cell: ({ row }) =>
				row.original.leaderName ? (
					<span>{row.original.leaderName}</span>
				) : (
					<span className="text-muted-foreground italic">Unassigned</span>
				),
		},
		{
			accessorKey: "hasReports",
			header: "Role",
			sortFn: "basic",
			cell: ({ row }) =>
				row.original.hasReports ? (
					<Badge variant="secondary">Leader</Badge>
				) : null,
		},
		{
			accessorKey: "status",
			header: "Status",
			sortFn: "text",
			cell: ({ row }) => (
				<Badge variant={STATUS_VARIANT[row.original.status] ?? "outline"}>
					{row.original.status}
				</Badge>
			),
		},
		{
			accessorKey: "profileIncomplete",
			header: "Profile",
			sortFn: "basic",
			cell: ({ row }) =>
				row.original.profileIncomplete ? (
					<Badge
						variant="outline"
						className="text-muted-foreground font-normal"
						title="Gender, residence or field of study is still blank"
					>
						Incomplete
					</Badge>
				) : null,
		},
		{
			id: "actions",
			header: "Actions",
			cell: ({ row }) => (
				<div className="flex items-center justify-end gap-1">
					<Button variant="ghost" size="sm" asChild>
						{/* View lands here until the member detail page ships. */}
						<a href={`#member-${row.original.id}`}>
							<Eye className="size-4" />
							<span className="sr-only sm:not-sr-only">View</span>
						</a>
					</Button>
					{canDelete ? <ConfirmDeleteMember member={row.original} /> : null}
				</div>
			),
		},
	];

	return columns;
}

/**
 * Rows arrive already scoped by the server — an admin's response carries every
 * member, a leader's carries only their own. Nothing here re-filters.
 */
export function MembersTable({ canDelete }: { canDelete: boolean }) {
	const { data } = useSuspenseQuery(membersQueryOptions);
	const [sorting, setSorting] = useState<SortingState>([]);
	const [globalFilter, setGlobalFilter] = useState("");
	const [columns] = useState(() => buildColumns(canDelete));

	const table = useTable({
		features,
		columns,
		data,
		state: { sorting, globalFilter },
		onSortingChange: setSorting,
		onGlobalFilterChange: setGlobalFilter,
		globalFilterFn: "includesString",
	});

	const rows = table.getRowModel().rows;

	return (
		<div className="flex flex-col gap-4">
			<Input
				value={globalFilter}
				onChange={(event) => setGlobalFilter(event.target.value)}
				placeholder="Filter by name, leader or status…"
				className="max-w-sm"
				aria-label="Filter members"
			/>

			<div className="overflow-hidden rounded-lg border">
				<Table>
					<TableHeader className="bg-muted/50">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										className={
											header.column.id === "actions" ? "text-right" : ""
										}
									>
										{header.isPlaceholder ? null : header.column.id ===
											"actions" ? (
											<table.FlexRender header={header} />
										) : (
											<Button
												variant="ghost"
												size="sm"
												className="-ml-3 h-8"
												onClick={() => header.column.toggleSorting()}
											>
												<table.FlexRender header={header} />
												<ArrowUpDown className="ml-2 size-3.5 opacity-60" />
											</Button>
										)}
									</TableHead>
								))}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{rows.length ? (
							rows.map((row) => (
								<TableRow key={row.id}>
									{row.getAllCells().map((cell) => (
										<TableCell key={cell.id}>
											<table.FlexRender cell={cell} />
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="h-24 text-center text-muted-foreground"
								>
									{data.length === 0
										? "No members yet."
										: "No members match that filter."}
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
