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
import {
	DataTablePagination,
	DEFAULT_PAGE_SIZE,
} from "@/components/shared/data-table-pagination.tsx";
import { MemberStatusBadge } from "@/components/shared/status-badge.tsx";
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
import { needsAttentionQueryOptions } from "./action.ts";
import {
	ATTENTION_REASON_LABELS,
	attentionReasonFor,
	type MemberNeedingAttentionRow,
} from "./query.ts";

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

const columns: ColumnDef<typeof features, MemberNeedingAttentionRow>[] = [
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
		id: "reason",
		header: "Needs attention because",
		sortFn: "text",
		accessorFn: (row) => ATTENTION_REASON_LABELS[attentionReasonFor(row)],
		cell: ({ row }) => (
			<Badge
				variant="outline"
				className="border-amber-500/40 font-normal text-amber-700 dark:text-amber-400"
			>
				{ATTENTION_REASON_LABELS[attentionReasonFor(row.original)]}
			</Badge>
		),
	},
	{
		accessorKey: "status",
		header: "Status",
		sortFn: "text",
		cell: ({ row }) => <MemberStatusBadge status={row.original.status} />,
	},
];

/**
 * Rows arrive already scoped: an admin sees everyone in the system who needs
 * attention, a leader sees the people directly under them.
 */
export function NeedsAttentionTable() {
	const { data } = useSuspenseQuery(needsAttentionQueryOptions);
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
			<div className="flex flex-wrap items-center justify-between gap-2">
				<Input
					value={globalFilter}
					onChange={(event) => {
						setGlobalFilter(event.target.value);
						setPagination((current) => ({ ...current, pageIndex: 0 }));
					}}
					placeholder="Filter by name, leader or status…"
					className="max-w-sm"
					aria-label="Filter members needing attention"
				/>
				<p className="text-muted-foreground text-sm">
					{data.length} {data.length === 1 ? "person needs" : "people need"}{" "}
					attention
				</p>
			</div>

			<div className="overflow-hidden rounded-lg border">
				<Table>
					<TableHeader className="bg-muted/50">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => (
									<TableHead key={header.id}>
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
									className="text-muted-foreground h-24 text-center"
								>
									{data.length === 0
										? "Nobody needs attention right now."
										: "No one matches that filter."}
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
				noun="people"
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
