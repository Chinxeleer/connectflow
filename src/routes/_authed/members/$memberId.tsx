import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
	MemberProfile,
	memberDetailQueryOptions,
} from "@/features/members/member-detail/index.ts";

export const Route = createFileRoute("/_authed/members/$memberId")({
	loader: ({ context, params }) => {
		// Not awaited: the shell paints immediately and Suspense fills it in.
		void context.queryClient.prefetchQuery(
			memberDetailQueryOptions(params.memberId),
		);
	},
	errorComponent: MemberProfileError,
	component: MemberProfilePage,
});

/**
 * Only reachable for a malformed id — the validator rejects anything that is
 * not a uuid before the handler runs. Everything a real user can click returns
 * a state the profile renders itself, so "not permitted" is a panel on the
 * page rather than an error boundary.
 */
function MemberProfileError() {
	return (
		<>
			<SiteHeader title="Member" />
			<div className="flex flex-1 flex-col p-4 lg:p-6">
				<Card>
					<CardHeader>
						<CardTitle>That member could not be opened.</CardTitle>
						<CardDescription>
							The link may be incomplete or mistyped.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button variant="outline" asChild>
							<Link to="/members">Back to members</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		</>
	);
}

function MemberProfilePage() {
	const { memberId } = Route.useParams();

	return (
		<>
			<SiteHeader title="Member" />

			<div className="flex flex-1 flex-col">
				<div className="@container/main flex flex-1 flex-col gap-2">
					<div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
						<div className="px-4 lg:px-6">
							<Suspense fallback={<Skeleton className="h-96 rounded-lg" />}>
								<MemberProfile memberId={memberId} />
							</Suspense>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
