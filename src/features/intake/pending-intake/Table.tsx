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
	sortFn_datetime,
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
import type { IntakeReconciliationStatus } from "@/db/schema/intake-reconciliations.ts";
import { memberIntakeSchema } from "@/features/intake/member-intake-webhook/index.ts";
import { pendingIntakeReconciliationsQueryOptions } from "./action.ts";
import type { PendingIntakeReconciliation } from "./query.ts";
import { ResolveIntakeReconciliationDialog } from "./ResolveDialog.tsx";

const STATUS_VARIANT: Record<
	IntakeReconciliationStatus,
	"default" | "secondary" | "outline"
> = {
	pending: "default",
	resolved: "secondary",
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	year: "numeric",
});

function submittedName(reconciliation: PendingIntakeReconciliation): string {
	const parsed = memberIntakeSchema.safeParse(reconciliation.rawPayload);
	return parsed.success
		? `${parsed.data.firstName} ${parsed.data.surname}`
		: "(unreadable submission)";
}

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
		datetime: sortFn_datetime,
	},
	filterFns: { includesString: filterFn_includesString },
});

const columns: ColumnDef<typeof features, PendingIntakeReconciliation>[] = [
	{
		id: "name",
		header: "Submitted as",
		accessorFn: (row) => submittedName(row),
		sortFn: "text",
	},
	{
		accessorKey: "createdAt",
		header: "Submitted",
		sortFn: "datetime",
		cell: ({ row }) => dateFormat.format(new Date(row.original.createdAt)),
	},
	{
		id: "candidates",
		header: "Candidates",
		cell: ({ row }) =>
			row.original.candidates.length > 0
				? row.original.candidates.map((c) => c.name).join(", ")
				: "None found",
	},
	{
		accessorKey: "status",
		header: "Status",
		sortFn: "text",
		cell: ({ row }) => (
			<Badge variant={STATUS_VARIANT[row.original.status]}>
				{row.original.status}
			</Badge>
		),
	},
	{
		accessorKey: "resolvedByName",
		header: "Handled by",
		sortFn: "text",
		cell: ({ row }) => row.original.resolvedByName ?? null,
	},
	{
		id: "actions",
		header: "Actions",
		cell: ({ row }) =>
			row.original.status === "pending" ? (
				<div className="flex items-center justify-end">
					<ResolveIntakeReconciliationDialog reconciliation={row.original} />
				</div>
			) : null,
	},
];

/**
 * Every intake submission `matchPerson` couldn't confidently resolve on its
 * own, newest first — the counterpart to `PendingRemovalsTable` on the intake
 * side. A resolved row stays visible, same reasoning as removals: it's a
 * record of what happened, not something to hide once handled.
 */
export function PendingIntakeReconciliationsTable() {
	const { data } = useSuspenseQuery(pendingIntakeReconciliationsQueryOptions);
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
				aria-label="Filter needs-review submissions"
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
												"actions" || header.column.id === "candidates" ? (
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
										? "Nothing needs review right now."
										: "No submissions match that filter."}
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
				noun="submissions"
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
