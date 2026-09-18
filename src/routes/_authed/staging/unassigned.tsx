import { createFileRoute, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
	UnassignedMembersTable,
	unassignedMembersQueryOptions,
} from "@/features/members/unassigned-members/index.ts";
import { isAdmin } from "@/lib/permissions.ts";

/**
 * Members with no leader. Admin-only, same gate as the rest of Staging — the
 * query behind it is org-wide, which is not something a leader should see.
 */
export const Route = createFileRoute("/_authed/staging/unassigned")({
	beforeLoad: ({ context }) => {
		if (!isAdmin(context.session.user)) {
			throw redirect({ to: "/dashboard" });
		}
	},
	loader: ({ context }) => {
		void context.queryClient.prefetchQuery(unassignedMembersQueryOptions);
	},
	component: StagingUnassignedPage,
});

function StagingUnassignedPage() {
	return (
		<>
			<SiteHeader title="Unassigned" />

			<div className="flex flex-1 flex-col">
				<div className="@container/main flex flex-1 flex-col gap-2">
					<div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
						<div>
							<h2 className="mb-1 text-base font-medium">
								Members without a leader
							</h2>
							<p className="text-muted-foreground mb-4 text-sm">
								Everyone not yet reporting to anyone. Assign a leader directly
								from here.
							</p>
							<Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
								<UnassignedMembersTable />
							</Suspense>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
