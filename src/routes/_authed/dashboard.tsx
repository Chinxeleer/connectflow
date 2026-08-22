import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { CreateUserDialog } from "@/features/users/create-user/index.ts";
import {
	UsersTable,
	usersQueryOptions,
} from "@/features/users/list-users/index.ts";
import {
	SectionCards,
	userStatsQueryOptions,
} from "@/features/users/stats/index.ts";
import { isAdmin } from "@/lib/permissions.ts";

export const Route = createFileRoute("/_authed/dashboard")({
	loader: ({ context }) => {
		// Only admins can read these, so only they are worth prefetching. Not
		// awaited: the route renders immediately and Suspense fills them in.
		if (isAdmin(context.session.user)) {
			void context.queryClient.prefetchQuery(userStatsQueryOptions);
			void context.queryClient.prefetchQuery(usersQueryOptions);
		}
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
			<SiteHeader
				title="Dashboard"
				actions={admin ? <CreateUserDialog /> : null}
			/>

			<div className="flex flex-1 flex-col">
				<div className="@container/main flex flex-1 flex-col gap-2">
					<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
						{admin ? (
							<>
								<Suspense fallback={<CardsSkeleton />}>
									<SectionCards />
								</Suspense>

								<div className="px-4 lg:px-6">
									<h2 className="mb-1 text-base font-medium">Users</h2>
									<p className="mb-4 text-sm text-muted-foreground">
										Everyone with access to ConnectFlow.
									</p>
									<Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
										<UsersTable />
									</Suspense>
								</div>
							</>
						) : (
							<div className="px-4 lg:px-6">
								<h2 className="text-base font-medium">
									Welcome, {session.user.name}
								</h2>
								<p className="mt-1 text-sm text-muted-foreground">
									Your assigned members and group capacity will appear here once
									those sections are built.
								</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
