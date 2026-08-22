import { createFileRoute } from "@tanstack/react-router";
import { Upload, UserPlus } from "lucide-react";
import { Suspense, useState } from "react";
import { SiteHeader } from "@/components/layout/site-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { ImportCsvForm } from "@/features/members/import-csv/index.ts";
import {
	MembersTable,
	membersQueryOptions,
} from "@/features/members/member-list/index.ts";
import {
	MemberStatsCards,
	memberStatsQueryOptions,
} from "@/features/members/member-stats/index.ts";
import { isAdmin } from "@/lib/permissions.ts";

export const Route = createFileRoute("/_authed/members/")({
	loader: ({ context }) => {
		// Not awaited — the shell paints immediately and Suspense fills in.
		void context.queryClient.prefetchQuery(memberStatsQueryOptions);
		void context.queryClient.prefetchQuery(membersQueryOptions);
	},
	component: MembersPage,
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

function ImportCsvDialog() {
	const [open, setOpen] = useState(false);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm">
					<Upload className="size-4" />
					Import CSV
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				{/* Remounted per open so a previous review step never lingers. */}
				{open ? <ImportCsvForm onImported={() => setOpen(false)} /> : null}
			</DialogContent>
		</Dialog>
	);
}

function MembersPage() {
	const { session } = Route.useRouteContext();
	const admin = isAdmin(session.user);

	return (
		<>
			<SiteHeader
				title="Members"
				actions={
					<>
						{admin ? <ImportCsvDialog /> : null}
						<Button size="sm" disabled title="Not built yet">
							<UserPlus className="size-4" />
							Add Member
						</Button>
					</>
				}
			/>

			<div className="flex flex-1 flex-col">
				<div className="@container/main flex flex-1 flex-col gap-2">
					<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
						<Suspense fallback={<CardsSkeleton />}>
							<MemberStatsCards />
						</Suspense>

						<div className="px-4 lg:px-6">
							<h2 className="mb-1 text-base font-medium">
								{admin ? "All members" : "Your members"}
							</h2>
							<p className="text-muted-foreground mb-4 text-sm">
								{admin
									? "Everyone in the system, across every connect group."
									: "The members who report directly to you."}
							</p>
							<Suspense fallback={<Skeleton className="h-64 rounded-lg" />}>
								<MembersTable canDelete={admin} />
							</Suspense>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
