import { useSuspenseQuery } from "@tanstack/react-query";
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
import {
	DataTablePagination,
	DEFAULT_PAGE_SIZE,
} from "@/components/shared/data-table-pagination.tsx";
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
import { connectLeadersQueryOptions } from "./action.ts";
import type { ConnectLeaderRow } from "./query.ts";

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

const columns: ColumnDef<typeof features, ConnectLeaderRow>[] = [
	{
		accessorKey: "name",
		header: "Connect leader",
		sortFn: "text",
		cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
	},
	{
		accessorKey: "status",
		header: "Status",
		sortFn: "text",
		cell: ({ row }) => (
			<Badge variant="outline" className="font-normal">
				{row.original.status}
			</Badge>
		),
	},
	{
		accessorKey: "directMembers",
		header: "Members leading",
		sortFn: "basic",
		cell: ({ row }) => (
			<span className="tabular-nums font-medium">
				{row.original.directMembers}
			</span>
		),
	},
];

/**
 * Rows arrive already scoped: an admin sees every connect leader, a leader
 * sees themselves and any sub-leaders under them.
 */
export function ConnectLeadersTable() {
	const { data } = useSuspenseQuery(connectLeadersQueryOptions);
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
	const totalLed = data.reduce((sum, row) => sum + row.directMembers, 0);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Input
					value={globalFilter}
					onChange={(event) => {
						setGlobalFilter(event.target.value);
						setPagination((current) => ({ ...current, pageIndex: 0 }));
					}}
					placeholder="Filter leaders…"
					className="max-w-sm"
					aria-label="Filter connect leaders"
				/>
				<p className="text-muted-foreground text-sm">
					{data.length} {data.length === 1 ? "leader" : "leaders"} · {totalLed}{" "}
					{totalLed === 1 ? "member" : "members"} led directly
				</p>
			</div>

			<div className="overflow-hidden rounded-lg border">
				<Table>
					<TableHeader className="bg-muted/50">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										className={
											header.column.id === "directMembers" ? "text-right" : ""
										}
									>
										{header.isPlaceholder ? null : (
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
										<TableCell
											key={cell.id}
											className={
												cell.column.id === "directMembers" ? "text-right" : ""
											}
										>
											<table.FlexRender cell={cell} />
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={columns.length}
									className="text-muted-foreground h-24 text-center"
								>
									{data.length === 0
										? "Nobody is leading a connect yet."
										: "No leaders match that filter."}
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
				noun="leaders"
				onPageChange={(pageIndex) =>
					setPagination((current) => ({ ...current, pageIndex }))
				}
				onPageSizeChange={(pageSize) =>
					// Back to the first page: page 7 of a 10-row view does not
					// exist once the page size becomes 100.
					setPagination({ pageIndex: 0, pageSize })
				}
			/>
		</div>
	);
}
