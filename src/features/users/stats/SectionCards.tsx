import { useSuspenseQuery } from "@tanstack/react-query";
import { ShieldCheck, UserPlus, Users, UsersRound } from "lucide-react";
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
import { userStatsQueryOptions } from "./action.ts";

function StatCard({
	label,
	value,
	icon: Icon,
	badge,
	headline,
	detail,
}: {
	label: string;
	value: number;
	icon: ComponentType<{ className?: string }>;
	badge: string;
	headline: string;
	detail: string;
}) {
	return (
		<Card className="@container/card">
			<CardHeader>
				<CardDescription>{label}</CardDescription>
				<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
					{value}
				</CardTitle>
				<CardAction>
					<Badge variant="outline">
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

export function SectionCards() {
	const { data } = useSuspenseQuery(userStatsQueryOptions);

	return (
		<div className="grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
			<StatCard
				label="Accounts"
				value={data.total}
				icon={Users}
				badge="all"
				headline="Everyone who can sign in"
				detail="Created by an admin — there is no public sign-up"
			/>
			<StatCard
				label="Admins"
				value={data.admins}
				icon={ShieldCheck}
				badge="full access"
				headline="Can run matching and settings"
				detail="Sees every member and every leader"
			/>
			<StatCard
				label="Leaders"
				value={data.leaders}
				icon={UsersRound}
				badge="scoped"
				headline="Scoped to their own group"
				detail="Cannot see other leaders' members"
			/>
			<StatCard
				label="Added this week"
				value={data.addedThisWeek}
				icon={UserPlus}
				badge="7 days"
				headline="Recent account activity"
				detail="New sign-ins provisioned in the last 7 days"
			/>
		</div>
	);
}
