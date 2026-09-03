import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
	HierarchyTree,
	hierarchyQueryOptions,
} from "@/features/members/hierarchy-tree/index.ts";
import { isAdmin } from "@/lib/permissions.ts";

export const Route = createFileRoute("/_authed/hierarchy")({
	loader: ({ context }) => {
		// Not awaited: the shell paints immediately and Suspense fills it in.
		// The tree is scoped server-side, so everyone gets their own.
		void context.queryClient.prefetchQuery(hierarchyQueryOptions);
	},
	component: HierarchyPage,
});

function HierarchyPage() {
	const { session } = Route.useRouteContext();
	const admin = isAdmin(session.user);

	return (
		<>
			<SiteHeader title="Hierarchy" />

			<div className="flex flex-1 flex-col">
				<div className="@container/main flex flex-1 flex-col gap-2">
					<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
						<div className="px-4 lg:px-6">
							<h2 className="mb-1 text-base font-medium">
								{admin ? "Every connect" : "Your connect"}
							</h2>
							<p className="text-muted-foreground mb-4 text-sm">
								{admin
									? "The whole structure, from the top of each connect down."
									: "Your connect and everyone below it. Open a name to see their profile."}
							</p>
							<Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
								<HierarchyTree />
							</Suspense>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
