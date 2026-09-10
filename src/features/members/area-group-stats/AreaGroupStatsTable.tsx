import { useSuspenseQuery } from "@tanstack/react-query";
import { MapPin, Network, Users } from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card.tsx";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table.tsx";
import { AREA_GROUP_LABELS } from "@/db/schema/members.ts";
import { areaGroupStatsQueryOptions } from "./action.ts";

/**
 * People and connects per area group, org-wide — an admin-only rollup, so
 * this never needs a scope prop the way the members table does.
 */
export function AreaGroupStatsTable() {
	const { data } = useSuspenseQuery(areaGroupStatsQueryOptions);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Areas</CardTitle>
				<CardDescription>
					Every area group, including any with nobody assigned yet.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Area</TableHead>
							<TableHead className="text-right">People</TableHead>
							<TableHead className="text-right">Connects</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.map((row) => (
							<TableRow key={row.areaGroup}>
								<TableCell>
									<div className="flex items-center gap-2">
										<MapPin className="text-muted-foreground size-4" />
										{AREA_GROUP_LABELS[row.areaGroup]}
									</div>
								</TableCell>
								<TableCell className="text-right">
									<div className="flex items-center justify-end gap-1.5 tabular-nums">
										{row.memberCount}
										<Users className="text-muted-foreground size-3.5" />
									</div>
								</TableCell>
								<TableCell className="text-right">
									<div className="flex items-center justify-end gap-1.5 tabular-nums">
										{row.connectCount}
										<Network className="text-muted-foreground size-3.5" />
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
