import { createFileRoute, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
	PendingRemovalsTable,
	pendingRemovalsQueryOptions,
} from "@/features/intake/pending-removals/index.ts";
import { isAdmin } from "@/lib/permissions.ts";

/**
 * Removal requests the Google Form webhook couldn't resolve on its own.
 * Admin-only, same gate as `/users` and `/areas` — the query behind it
 * rejects a leader outright.
 */
export const Route = createFileRoute("/_authed/review-queue")({
	beforeLoad: ({ context }) => {
		if (!isAdmin(context.session.user)) {
			throw redirect({ to: "/dashboard" });
		}
	},
	loader: ({ context }) => {
		void context.queryClient.prefetchQuery(pendingRemovalsQueryOptions);
	},
	component: ReviewQueuePage,
});

function ReviewQueuePage() {
	return (
		<>
			<SiteHeader title="Review Queue" />

			<div className="flex flex-1 flex-col">
				<div className="@container/main flex flex-1 flex-col gap-2">
					<div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
						<div>
							<h2 className="mb-1 text-base font-medium">Removal requests</h2>
							<p className="text-muted-foreground mb-4 text-sm">
								Submitted through the "remove a member" form. A request lands
								here when zero or several members matched the name given.
							</p>
							<Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
								<PendingRemovalsTable />
							</Suspense>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
