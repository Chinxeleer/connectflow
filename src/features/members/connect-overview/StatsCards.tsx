import { useSuspenseQuery } from "@tanstack/react-query";
import { Gauge, Network, TriangleAlert, Users } from "lucide-react";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge.tsx";
import {
	Card,
	CardAction,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card.tsx";
import { cn } from "@/lib/utils.ts";
import { connectOverviewQueryOptions } from "./action.ts";
import { averageConnectSize } from "./query.ts";

function StatCard({
	label,
	value,
	icon: Icon,
	badge,
	headline,
	detail,
	tone = "neutral",
}: {
	label: string;
	value: string | number;
	icon: ComponentType<{ className?: string }>;
	badge: string;
	headline: string;
	detail: string;
	tone?: "neutral" | "warning";
}) {
	const warning = tone === "warning";

	return (
		<Card
			className={cn(
				"@container/card",
				warning &&
					"!bg-gradient-to-t !from-amber-500/10 !to-card border-amber-500/40 dark:border-amber-400/30",
			)}
		>
			<CardHeader>
				<CardDescription
					className={cn(warning && "text-amber-700 dark:text-amber-400")}
				>
					{label}
				</CardDescription>
				<CardTitle
					className={cn(
						"text-2xl font-semibold tabular-nums @[250px]/card:text-3xl",
						warning && value !== 0 && "text-amber-700 dark:text-amber-400",
					)}
				>
					{value}
				</CardTitle>
				<CardAction>
					<Badge
						variant="outline"
						className={cn(
							warning &&
								"border-amber-500/40 text-amber-700 dark:text-amber-400",
						)}
					>
						<Icon className="size-3.5" />
						{badge}
					</Badge>
				</CardAction>
			</CardHeader>
			<CardFooter className="flex-col items-start gap-1.5 text-sm">
				<div className="line-clamp-1 flex gap-2 font-medium">{headline}</div>
				<div className="text-muted-foreground">{detail}</div>
			</CardFooter>
		</Card>
	);
}

/**
 * How the connects are doing, scoped server-side — an admin sees the whole
 * system, a leader sees the people directly under them.
 */
export function ConnectOverviewCards() {
	const { data } = useSuspenseQuery(connectOverviewQueryOptions);
	const average = averageConnectSize(data);

	return (
		<div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
			<StatCard
				label="Members"
				value={data.totalMembers}
				icon={Users}
				badge="in scope"
				headline="Everyone you can see"
				detail={`${data.membersInAConnect} of them sit in a connect`}
			/>
			<StatCard
				label="Without a Connect"
				value={data.withoutConnect}
				icon={TriangleAlert}
				badge="unassigned"
				headline={
					data.withoutConnect === 0
						? "Everyone has a connect leader"
						: "Waiting on a connect leader"
				}
				detail="These need assigning before induction can start"
				tone="warning"
			/>
			<StatCard
				label="Active Connects"
				value={data.activeConnects}
				icon={Network}
				badge="running"
				headline="Connects currently meeting"
				detail="Members with at least one person under them"
			/>
			<StatCard
				label="Average Connect Size"
				value={average}
				icon={Gauge}
				badge="per connect"
				headline={
					data.largestConnect > 0
						? `Largest carries ${data.largestConnect}`
						: "No connects yet"
				}
				detail="Members carried directly, averaged across connects"
			/>
		</div>
	);
}
