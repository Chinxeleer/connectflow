import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	type ColumnDef,
	columnFilteringFeature,
	createFilteredRowModel,
	createPaginatedRowModel,
	createSortedRowModel,
	filterFn_includesString,
	globalFilteringFeature,
	rowPaginationFeature,
	rowSortingFeature,
	type SortingState,
	sortFn_alphanumeric,
	sortFn_basic,
	sortFn_text,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
import { useState } from "react";
import { AreaGroupBadge } from "@/components/shared/area-group-badge.tsx";
import {
	DataTablePagination,
	DEFAULT_PAGE_SIZE,
} from "@/components/shared/data-table-pagination.tsx";
import { MemberStatusBadge } from "@/components/shared/status-badge.tsx";
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
import { AssignLeaderButton } from "./AssignLeaderButton.tsx";
import { unassignedMembersQueryOptions } from "./action.ts";
import type { UnassignedMemberRow } from "./query.ts";

const features = tableFeatures({
	rowPaginationFeature,
	rowSortingFeature,
	columnFilteringFeature,
	globalFilteringFeature,
	sortedRowModel: createSortedRowModel(),
	filteredRowModel: createFilteredRowModel(),
	paginatedRowModel: createPaginatedRowModel(),
	sortFns: {
		alphanumeric: sortFn_alphanumeric,
		basic: sortFn_basic,
		text: sortFn_text,
	},
	filterFns: { includesString: filterFn_includesString },
});

const columns: ColumnDef<typeof features, UnassignedMemberRow>[] = [
	{
		accessorKey: "name",
		header: "Name",
		sortFn: "text",
		cell: ({ row }) => (
			<Link
				to="/members/$memberId"
				params={{ memberId: row.original.id }}
				className="font-medium underline-offset-4 hover:underline"
			>
				{row.original.name}
			</Link>
		),
	},
	{
		accessorKey: "areaGroup",
		header: "Area group",
		sortFn: "basic",
		cell: ({ row }) =>
			row.original.areaGroup ? (
				<AreaGroupBadge areaGroup={row.original.areaGroup} />
			) : (
				<span className="text-muted-foreground italic">Not set</span>
			),
	},
	{
		accessorKey: "status",
		header: "Status",
		sortFn: "text",
		cell: ({ row }) => <MemberStatusBadge status={row.original.status} />,
	},
	{
		id: "actions",
		header: "Actions",
		cell: ({ row }) => (
			<div className="flex justify-end">
				<AssignLeaderButton member={row.original} />
			</div>
		),
	},
];

/**
 * Everyone without a connect leader, with an assign action right on the
 * row — the "Without a Connect" dashboard number, made actionable.
 */
export function UnassignedMembersTable() {
	const { data } = useSuspenseQuery(unassignedMembersQueryOptions);
	const [sorting, setSorting] = useState<SortingState>([]);
	const [globalFilter, setGlobalFilter] = useState("");
	const [pagination, setPagination] = useState({
		pageIndex: 0,
		pageSize: DEFAULT_PAGE_SIZE,
	});

	const table = useTable({
		features,
		columns,
		data,
		state: { sorting, globalFilter, pagination },
		onSortingChange: setSorting,
		onGlobalFilterChange: setGlobalFilter,
		onPaginationChange: setPagination,
		globalFilterFn: "includesString",
	});

	const rows = table.getRowModel().rows;
	const filteredCount = table.getFilteredRowModel().rows.length;

	return (
		<div className="flex flex-col gap-4">
			<Input
				value={globalFilter}
				onChange={(event) => {
					setGlobalFilter(event.target.value);
					setPagination((current) => ({ ...current, pageIndex: 0 }));
				}}
				placeholder="Filter by name or status…"
				className="max-w-sm"
				aria-label="Filter unassigned members"
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
										? "Everyone has a connect leader."
										: "No members match that filter."}
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<DataTablePagination
				pageIndex={pagination.pageIndex}
				pageSize={pagination.pageSize}
				pageCount={table.getPageCount()}
				filteredRows={filteredCount}
				totalRows={data.length}
				noun="members"
				onPageChange={(pageIndex) =>
					setPagination((current) => ({ ...current, pageIndex }))
				}
				onPageSizeChange={(pageSize) =>
					setPagination({ pageIndex: 0, pageSize })
				}
			/>
		</div>
	);
}
