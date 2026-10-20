import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { BulkGrantAccessButton } from "@/features/leaders/grant-access/index.ts";
import {
	LeaderStatsCards,
	leaderStatsQueryOptions,
} from "@/features/leaders/leader-stats/index.ts";
import {
	ConnectLeadersTable,
	connectLeadersQueryOptions,
} from "@/features/members/leader-summary/index.ts";
import { isAdmin } from "@/lib/permissions.ts";

export const Route = createFileRoute("/_authed/leaders")({
	loader: ({ context }) => {
		void context.queryClient.prefetchQuery(leaderStatsQueryOptions);
		void context.queryClient.prefetchQuery(connectLeadersQueryOptions);
	},
	component: LeadersPage,
});

function CardsSkeleton() {
	return (
		<div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-3">
			{[0, 1, 2].map((i) => (
				<Skeleton key={i} className="h-36 rounded-xl" />
			))}
		</div>
	);
}

function LeadersPage() {
	const { session } = Route.useRouteContext();
	const admin = isAdmin(session.user);

	return (
		<>
			<SiteHeader
				title="Leaders"
				actions={admin ? <BulkGrantAccessButton /> : null}
			/>

			<div className="flex flex-1 flex-col">
				<div className="@container/main flex flex-1 flex-col gap-2">
					<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
						<Suspense fallback={<CardsSkeleton />}>
							<LeaderStatsCards />
						</Suspense>

						<div className="px-4 lg:px-6">
							<h2 className="mb-1 text-base font-medium">Connect leaders</h2>
							<p className="text-muted-foreground mb-4 text-sm">
								{admin
									? "Everyone leading a connect, and how many members they carry directly."
									: "Your connect, and any leaders under you, with the members each carries directly."}
							</p>
							<Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
								<ConnectLeadersTable canGrantAccess={admin} />
							</Suspense>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
