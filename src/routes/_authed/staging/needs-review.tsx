import { createFileRoute, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
	PendingIntakeReconciliationsTable,
	pendingIntakeReconciliationsQueryOptions,
} from "@/features/intake/pending-intake/index.ts";
import { isAdmin } from "@/lib/permissions.ts";

/**
 * Intake submissions `matchPerson` couldn't confidently resolve on its own.
 * Admin-only, same gate as the rest of Staging.
 */
export const Route = createFileRoute("/_authed/staging/needs-review")({
	beforeLoad: ({ context }) => {
		if (!isAdmin(context.session.user)) {
			throw redirect({ to: "/dashboard" });
		}
	},
	loader: ({ context }) => {
		void context.queryClient.prefetchQuery(
			pendingIntakeReconciliationsQueryOptions,
		);
	},
	component: StagingNeedsReviewPage,
});

function StagingNeedsReviewPage() {
	return (
		<>
			<SiteHeader title="Needs Review" />

			<div className="flex flex-1 flex-col">
				<div className="@container/main flex flex-1 flex-col gap-2">
					<div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
						<div>
							<h2 className="mb-1 text-base font-medium">
								Submissions needing a decision
							</h2>
							<p className="text-muted-foreground mb-4 text-sm">
								Submitted through the "new member" form. A submission lands here
								whenever a name match alone isn't enough to safely update
								someone automatically.
							</p>
							<Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
								<PendingIntakeReconciliationsTable />
							</Suspense>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
