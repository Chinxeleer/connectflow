import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
	NotLeadingStatsCards,
	NotLeadingTable,
	notLeadingMembersQueryOptions,
	notLeadingOverviewQueryOptions,
} from "@/features/leaders/not-leading/index.ts";
import { isAdmin } from "@/lib/permissions.ts";

export const Route = createFileRoute("/_authed/leaders")({
	loader: ({ context }) => {
		void context.queryClient.prefetchQuery(notLeadingOverviewQueryOptions);
		void context.queryClient.prefetchQuery(notLeadingMembersQueryOptions);
	},
	component: LeadersPage,
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

function LeadersPage() {
	const { session } = Route.useRouteContext();
	const admin = isAdmin(session.user);

	return (
		<>
			<SiteHeader title="Leaders" />

			<div className="flex flex-1 flex-col">
				<div className="@container/main flex flex-1 flex-col gap-2">
					<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
						<Suspense fallback={<CardsSkeleton />}>
							<NotLeadingStatsCards />
						</Suspense>

						<div className="px-4 lg:px-6">
							<h2 className="mb-1 text-base font-medium">
								Not leading a connect yet
							</h2>
							<p className="text-muted-foreground mb-4 text-sm">
								{admin
									? "Everyone in the system with nobody reporting to them yet."
									: "The people under you with nobody reporting to them yet."}
							</p>
							<Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
								<NotLeadingTable />
							</Suspense>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
