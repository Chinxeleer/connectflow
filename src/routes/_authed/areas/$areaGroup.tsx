import { createFileRoute, redirect } from "@tanstack/react-router";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
	AREA_GROUP_LABELS,
	type AreaGroup,
	areaGroup,
} from "@/db/schema/members.ts";
import {
	AreaMembersTable,
	AreaOverviewCards,
	areaMembersQueryOptions,
	areaOverviewQueryOptions,
} from "@/features/members/area-detail/index.ts";
import { isAdmin } from "@/lib/permissions.ts";

function isAreaGroup(value: string): value is AreaGroup {
	return (areaGroup.enumValues as readonly string[]).includes(value);
}

/**
 * One area group's stats and roster. Admin-only, same gate as `/areas` — a
 * mistyped or hand-edited slug redirects to the overview rather than
 * rendering a page of errors, the same choice `/users` makes for a leader.
 */
export const Route = createFileRoute("/_authed/areas/$areaGroup")({
	beforeLoad: ({ context }) => {
		if (!isAdmin(context.session.user)) {
			throw redirect({ to: "/dashboard" });
		}
	},
	loader: ({ context, params }) => {
		if (!isAreaGroup(params.areaGroup)) {
			throw redirect({ to: "/areas" });
		}

		void context.queryClient.prefetchQuery(
			areaOverviewQueryOptions(params.areaGroup),
		);
		void context.queryClient.prefetchQuery(
			areaMembersQueryOptions(params.areaGroup),
		);
	},
	component: AreaDetailPage,
});

function CardsSkeleton() {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
			{[0, 1, 2, 3].map((key) => (
				<Skeleton key={key} className="h-28 rounded-xl" />
			))}
		</div>
	);
}

function AreaDetailPage() {
	const { areaGroup: rawGroup } = Route.useParams();
	// The loader already redirected away from anything else, so this narrows
	// rather than re-validates.
	const group = rawGroup as AreaGroup;

	return (
		<>
			<SiteHeader title={AREA_GROUP_LABELS[group]} />

			<div className="flex flex-1 flex-col">
				<div className="@container/main flex flex-1 flex-col gap-2">
					<div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
						<Suspense fallback={<CardsSkeleton />}>
							<AreaOverviewCards group={group} />
						</Suspense>

						<div>
							<h2 className="mb-1 text-base font-medium">
								People in {AREA_GROUP_LABELS[group]}
							</h2>
							<p className="text-muted-foreground mb-4 text-sm">
								Everyone assigned to this area, across every connect.
							</p>
							<Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
								<AreaMembersTable group={group} />
							</Suspense>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
