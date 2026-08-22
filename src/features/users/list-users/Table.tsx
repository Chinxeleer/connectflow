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
	sortFn_datetime,
	sortFn_text,
	tableFeatures,
	useTable,
} from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";
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
import { usersQueryOptions } from "./action.ts";
import type { UserListRow } from "./query.ts";

/**
 * Declared statically, outside the component, as the table docs require —
 * only the features this table actually uses are pulled into the bundle.
 */
const features = tableFeatures({
	rowSortingFeature,
	columnFilteringFeature,
	globalFilteringFeature,
	sortedRowModel: createSortedRowModel(),
	filteredRowModel: createFilteredRowModel(),
	sortFns: {
		alphanumeric: sortFn_alphanumeric,
		text: sortFn_text,
		datetime: sortFn_datetime,
	},
	filterFns: { includesString: filterFn_includesString },
});

const dateFormat = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "short",
	year: "numeric",
});

const columns: ColumnDef<typeof features, UserListRow>[] = [
	{
		accessorKey: "name",
		header: "Name",
		sortFn: "text",
		cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
	},
	{
		accessorKey: "email",
		header: "Email",
		sortFn: "text",
		cell: ({ row }) => (
			<span className="text-muted-foreground">{row.original.email}</span>
		),
	},
	{
		accessorKey: "role",
		header: "Role",
		sortFn: "text",
		cell: ({ row }) => (
			<Badge variant={row.original.role === "admin" ? "default" : "secondary"}>
				{row.original.role}
			</Badge>
		),
	},
	{
		accessorKey: "createdAt",
		header: "Added",
		sortFn: "datetime",
		cell: ({ row }) => (
			<span className="text-muted-foreground tabular-nums">
				{dateFormat.format(new Date(row.original.createdAt))}
			</span>
		),
	},
];

export function UsersTable() {
	const { data } = useSuspenseQuery(usersQueryOptions);
	const [sorting, setSorting] = useState<SortingState>([]);
	const [globalFilter, setGlobalFilter] = useState("");

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
				placeholder="Filter by name, email or role…"
				className="max-w-sm"
				aria-label="Filter users"
			/>

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
									className="h-24 text-center text-muted-foreground"
								>
									No users match that filter.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
