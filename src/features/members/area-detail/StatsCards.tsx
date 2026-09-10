import { useSuspenseQuery } from "@tanstack/react-query";
import { Network, TriangleAlert, Users, UserX } from "lucide-react";
import type { ComponentType } from "react";
import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card.tsx";
import type { AreaGroup } from "@/db/schema/members.ts";
import { areaOverviewQueryOptions } from "./action.ts";

function StatCard({
	label,
	value,
	icon: Icon,
}: {
	label: string;
	value: number;
	icon: ComponentType<{ className?: string }>;
}) {
	return (
		<Card className="@container/card">
			<CardHeader>
				<CardDescription className="flex items-center gap-1.5">
					<Icon className="size-3.5" />
					{label}
				</CardDescription>
				<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
					{value}
				</CardTitle>
			</CardHeader>
		</Card>
	);
}

/**
 * The four headline numbers for one area group — the same question
 * `ConnectOverviewCards` answers org-wide or per-leader, asked with "stays in
 * this area" as the filter instead.
 */
export function AreaOverviewCards({ group }: { group: AreaGroup }) {
	const { data } = useSuspenseQuery(areaOverviewQueryOptions(group));

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<StatCard label="Total members" value={data.totalMembers} icon={Users} />
			<StatCard
				label="Without a connect"
				value={data.withoutConnect}
				icon={TriangleAlert}
			/>
			<StatCard
				label="Leading a connect"
				value={data.leadingConnect}
				icon={Network}
			/>
			<StatCard
				label="Not leading a connect"
				value={data.notLeadingConnect}
				icon={UserX}
			/>
		</div>
	);
}
