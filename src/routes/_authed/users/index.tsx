import { createFileRoute, redirect } from "@tanstack/react-router";
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
import { APP_NAME } from "@/lib/app.ts";
import { isAdmin } from "@/lib/permissions.ts";

/**
 * Account management. Admin-only: the queries behind it reject a leader
 * outright, so this redirects rather than rendering a page of errors.
 */
export const Route = createFileRoute("/_authed/users/")({
	beforeLoad: ({ context }) => {
		if (!isAdmin(context.session.user)) {
			throw redirect({ to: "/dashboard" });
		}
	},
	loader: ({ context }) => {
		// Not awaited: the route renders immediately and Suspense fills these in.
		void context.queryClient.prefetchQuery(userStatsQueryOptions);
		void context.queryClient.prefetchQuery(usersQueryOptions);
	},
	component: UsersPage,
});

function CardsSkeleton() {
	return (
		<div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
			{[0, 1, 2, 3].map((key) => (
				<Skeleton key={key} className="h-36 rounded-xl" />
			))}
		</div>
	);
}

function UsersPage() {
	return (
		<>
			<SiteHeader title="Users" actions={<CreateUserDialog />} />

			<div className="flex flex-1 flex-col">
				<div className="@container/main flex flex-1 flex-col gap-2">
					<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
						<Suspense fallback={<CardsSkeleton />}>
							<SectionCards />
						</Suspense>

						<div className="px-4 lg:px-6">
							<h2 className="mb-1 text-base font-medium">All users</h2>
							<p className="text-muted-foreground mb-4 text-sm">
								Everyone with access to {APP_NAME}. Accounts are created here —
								there is no public sign-up.
							</p>
							<Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
								<UsersTable />
							</Suspense>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
