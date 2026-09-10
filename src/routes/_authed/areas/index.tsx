import { createFileRoute, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
	AreaGroupStatsTable,
	areaGroupStatsQueryOptions,
} from "@/features/members/area-group-stats/index.ts";
import { isAdmin } from "@/lib/permissions.ts";

/**
 * Area-group stats, org-wide. Admin-only: the query behind it rejects a
 * leader outright, so this redirects rather than rendering a page of errors.
 */
export const Route = createFileRoute("/_authed/areas/")({
	beforeLoad: ({ context }) => {
		if (!isAdmin(context.session.user)) {
			throw redirect({ to: "/dashboard" });
		}
	},
	loader: ({ context }) => {
		void context.queryClient.prefetchQuery(areaGroupStatsQueryOptions);
	},
	component: AreasPage,
});

function AreasPage() {
	return (
		<>
			<SiteHeader title="Areas" />

			<div className="flex flex-1 flex-col">
				<div className="@container/main flex flex-1 flex-col gap-2">
					<div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
						<Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
							<AreaGroupStatsTable />
						</Suspense>
					</div>
				</div>
			</div>
		</>
	);
}
