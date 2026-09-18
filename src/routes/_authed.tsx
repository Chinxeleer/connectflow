import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useRouter,
} from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar.tsx";
import { SiteHeader } from "@/components/layout/site-header.tsx";
import { StatusPage } from "@/components/shared/status-page.tsx";
import { Button } from "@/components/ui/button.tsx";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar.tsx";
import { sessionQueryOptions } from "@/lib/auth-server.ts";

/**
 * Auth guard for everything nested below, and the single source of `session`
 * for those routes. Also supplies the dashboard shell (sidebar + inset) that
 * every authenticated page renders inside.
 *
 * The session is resolved here rather than in the root route's `beforeLoad`:
 * a root `beforeLoad` result is computed once for the root match and is not
 * re-run on client navigation, so it goes stale the moment someone signs in.
 *
 * `fetchQuery`, not `ensureQueryData`: the latter returns whatever is cached
 * even when the entry has been invalidated, so a fresh sign-in would still
 * read the pre-login `null` and bounce straight back to the login page.
 */
export const Route = createFileRoute("/_authed")({
	beforeLoad: async ({ context, location }) => {
		const session = await context.queryClient.fetchQuery(sessionQueryOptions);

		if (!session) {
			throw redirect({ to: "/", search: { redirect: location.href } });
		}

		return { session };
	},
	component: AuthedLayout,
	notFoundComponent: AuthedNotFound,
	errorComponent: AuthedError,
});

function AuthedLayout() {
	const { session } = Route.useRouteContext();

	return (
		<SidebarProvider
			style={
				{
					"--sidebar-width": "calc(var(--spacing) * 72)",
					"--header-height": "calc(var(--spacing) * 12)",
				} as CSSProperties
			}
		>
			<AppSidebar variant="inset" user={session.user} />
			<SidebarInset>
				<Outlet />
			</SidebarInset>
		</SidebarProvider>
	);
}

/**
 * A stale link or a typo'd URL inside the app — rendered in place of the
 * `<Outlet />` above, so the sidebar and nav stay put rather than dropping
 * the reader onto a bare page they'd have to navigate away from scratch.
 */
function AuthedNotFound() {
	return (
		<>
			<SiteHeader title="Not Found" />
			<div className="flex flex-1 items-center justify-center py-16">
				<StatusPage
					code="404"
					title="Page not found"
					description="That page doesn't exist, or it may have moved."
					actions={
						<Button asChild>
							<Link to="/dashboard">Back to dashboard</Link>
						</Button>
					}
				/>
			</div>
		</>
	);
}

function AuthedError({ error }: { error: Error }) {
	const router = useRouter();

	return (
		<>
			<SiteHeader title="Something Went Wrong" />
			<div className="flex flex-1 items-center justify-center py-16">
				<StatusPage
					code="Error"
					title="Something went wrong"
					description={error.message || "An unexpected error occurred."}
					actions={
						<>
							<Button variant="outline" onClick={() => router.invalidate()}>
								Try again
							</Button>
							<Button asChild>
								<Link to="/dashboard">Back to dashboard</Link>
							</Button>
						</>
					}
				/>
			</div>
		</>
	);
}
