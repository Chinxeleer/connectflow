import { useSuspenseQuery } from "@tanstack/react-query";
import { Crown, KeyRound, TriangleAlert } from "lucide-react";
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
import { leaderStatsQueryOptions } from "./action.ts";

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
	value: number;
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
						warning && value > 0 && "text-amber-700 dark:text-amber-400",
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
 * Counts are already scoped server-side — an admin sees the whole system, a
 * leader sees themselves and any sub-leaders under them.
 */
export function LeaderStatsCards() {
	const { data } = useSuspenseQuery(leaderStatsQueryOptions);

	return (
		<div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3 dark:*:data-[slot=card]:bg-card">
			<StatCard
				label="Leaders"
				value={data.totalLeaders}
				icon={Crown}
				badge="leading a connect"
				headline="People with at least one member under them"
				detail="This is what makes someone a leader here"
			/>
			<StatCard
				label="Without Login Access"
				value={data.withoutAccess}
				icon={KeyRound}
				badge="can send"
				headline={
					data.withoutAccess === 0
						? "Every leader has access"
						: "Ready for a login to be sent"
				}
				detail="Has an email on file — one click away"
				tone="warning"
			/>
			<StatCard
				label="Missing an Email"
				value={data.missingEmail}
				icon={TriangleAlert}
				badge="can't send yet"
				headline={
					data.missingEmail === 0
						? "Nobody is missing an email"
						: "No email on file to send access to"
				}
				detail="Add an email to their profile first"
			/>
		</div>
	);
}
