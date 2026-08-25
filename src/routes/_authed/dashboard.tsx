import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
	ConnectOverviewCards,
	connectOverviewQueryOptions,
} from "@/features/members/connect-overview/index.ts";
import {
	ConnectLeadersTable,
	connectLeadersQueryOptions,
} from "@/features/members/leader-summary/index.ts";
import { isAdmin } from "@/lib/permissions.ts";

export const Route = createFileRoute("/_authed/dashboard")({
	loader: ({ context }) => {
		// Not awaited: the route renders immediately and Suspense fills these in.
		// Both are scoped server-side, so everyone gets them.
		void context.queryClient.prefetchQuery(connectOverviewQueryOptions);
		void context.queryClient.prefetchQuery(connectLeadersQueryOptions);
	},
	component: Dashboard,
});

function CardsSkeleton() {
	return (
		<div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
			{[0, 1, 2, 3].map((i) => (
				<Skeleton key={i} className="h-36 rounded-xl" />
			))}
		</div>
	);
}

function Dashboard() {
	const { session } = Route.useRouteContext();
	const admin = isAdmin(session.user);

	return (
		<>
			<SiteHeader title="Dashboard" />

			<div className="flex flex-1 flex-col">
				<div className="@container/main flex flex-1 flex-col gap-2">
					<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
						<Suspense fallback={<CardsSkeleton />}>
							<ConnectOverviewCards />
						</Suspense>

						<div className="px-4 lg:px-6">
							<h2 className="mb-1 text-base font-medium">Connect leaders</h2>
							<p className="text-muted-foreground mb-4 text-sm">
								{admin
									? "Everyone leading a connect, and how many members they carry directly."
									: "Your connect, and any leaders under you, with the members each carries directly."}
							</p>
							<Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
								<ConnectLeadersTable />
							</Suspense>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
