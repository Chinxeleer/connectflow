import {
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select.tsx";

export const PAGE_SIZES = [10, 25, 50, 100] as const;

export const DEFAULT_PAGE_SIZE = 10;

/**
 * Pagination footer shared by every data table.
 *
 * Takes plain values rather than a table instance: each table declares its own
 * TanStack `tableFeatures`, so a shared component typed against one of them
 * would not accept the others.
 */
export function DataTablePagination({
	pageIndex,
	pageSize,
	pageCount,
	filteredRows,
	totalRows,
	noun,
	onPageChange,
	onPageSizeChange,
}: {
	pageIndex: number;
	pageSize: number;
	pageCount: number;
	/** Rows after filtering — what is actually being paged through. */
	filteredRows: number;
	/** Rows before filtering, so a filter's effect is visible. */
	totalRows: number;
	/** Plural noun for the summary, e.g. "members". */
	noun: string;
	onPageChange: (pageIndex: number) => void;
	onPageSizeChange: (pageSize: number) => void;
}) {
	const first = filteredRows === 0 ? 0 : pageIndex * pageSize + 1;
	const last = Math.min((pageIndex + 1) * pageSize, filteredRows);
	const filtered = filteredRows !== totalRows;

	return (
		<div className="flex flex-wrap items-center justify-between gap-4 px-1">
			<p className="text-muted-foreground text-sm">
				{filteredRows === 0
					? `No ${noun}`
					: `Showing ${first}–${last} of ${filteredRows} ${noun}`}
				{filtered ? ` (filtered from ${totalRows})` : ""}
			</p>

			<div className="flex flex-wrap items-center gap-4 sm:gap-6">
				<div className="flex items-center gap-2">
					<span className="text-sm font-medium whitespace-nowrap">
						Rows per page
					</span>
					<Select
						value={String(pageSize)}
						onValueChange={(value) => onPageSizeChange(Number(value))}
					>
						<SelectTrigger size="sm" className="w-[4.5rem]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{PAGE_SIZES.map((size) => (
								<SelectItem key={size} value={String(size)}>
									{size}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<span className="text-sm font-medium whitespace-nowrap">
					Page {Math.min(pageIndex + 1, Math.max(pageCount, 1))} of{" "}
					{Math.max(pageCount, 1)}
				</span>

				<div className="flex items-center gap-1">
					<Button
						variant="outline"
						size="icon"
						className="size-8"
						onClick={() => onPageChange(0)}
						disabled={pageIndex === 0}
						aria-label="First page"
					>
						<ChevronsLeft className="size-4" />
					</Button>
					<Button
						variant="outline"
						size="icon"
						className="size-8"
						onClick={() => onPageChange(pageIndex - 1)}
						disabled={pageIndex === 0}
						aria-label="Previous page"
					>
						<ChevronLeft className="size-4" />
					</Button>
					<Button
						variant="outline"
						size="icon"
						className="size-8"
						onClick={() => onPageChange(pageIndex + 1)}
						disabled={pageIndex >= pageCount - 1}
						aria-label="Next page"
					>
						<ChevronRight className="size-4" />
					</Button>
					<Button
						variant="outline"
						size="icon"
						className="size-8"
						onClick={() => onPageChange(pageCount - 1)}
						disabled={pageIndex >= pageCount - 1}
						aria-label="Last page"
					>
						<ChevronsRight className="size-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}
