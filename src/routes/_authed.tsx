import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar.tsx";
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
