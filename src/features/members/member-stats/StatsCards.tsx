import { useSuspenseQuery } from "@tanstack/react-query";
import { Network, TriangleAlert, UserRound, Users } from "lucide-react";
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
import { memberStatsQueryOptions } from "./action.ts";

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
				// The one number that should pull the eye: members with no connect
				// leader are the backlog this page exists to clear.
				warning &&
					"border-amber-500/40 !bg-gradient-to-t !from-amber-500/10 !to-card dark:border-amber-400/30",
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
 * leader sees only their own direct members.
 */
export function MemberStatsCards() {
	const { data } = useSuspenseQuery(memberStatsQueryOptions);

	return (
		<div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
			<StatCard
				label="Total Members"
				value={data.total}
				icon={Users}
				badge="in scope"
				headline="Everyone you can see"
				detail="Admins see all; leaders see their own group"
			/>
			<StatCard
				label="Without a Connect"
				value={data.withoutConnect}
				icon={TriangleAlert}
				badge="unassigned"
				headline="Waiting on a connect leader"
				detail="These need assigning before induction can start"
				tone="warning"
			/>
			<StatCard
				label="Leading a Connect"
				value={data.leadingAGroup}
				icon={Network}
				badge="leaders"
				headline="Number of connects we currently have"
				detail="These are people who have 1 or more connect members under them."
			/>
			<StatCard
				label="Not Leading a Connect"
				value={data.notLeadingAConnect}
				icon={UserRound}
				badge="no group"
				headline="Members with nobody reporting to them"
				detail="Nobody sits under them yet — not the same as having no leader"
			/>
		</div>
	);
}
