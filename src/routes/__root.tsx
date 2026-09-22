import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Scripts,
	useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { StatusPage } from "@/components/shared/status-page.tsx";
import { Button } from "@/components/ui/button.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import TanStackQueryDevtools from "@/integrations/tanstack-query/devtools.tsx";
import { APP_NAME } from "@/lib/app.ts";
import appCss from "../styles.css?url";

interface MyRouterContext {
	queryClient: QueryClient;
}

/**
 * The fallback of last resort — rendered before there's necessarily any
 * session to trust, so its only safe link is `/`: the login page for a
 * signed-out visitor, and an automatic bounce onward to `/dashboard` for a
 * signed-in one (see `routes/index.tsx`'s own `beforeLoad`). A path that
 * never matched any route lands here; one that matched inside `_authed`
 * renders `_authed`'s own not-found instead, with the sidebar still visible.
 */
function RootNotFound() {
	return (
		<div className="bg-background flex min-h-svh flex-col items-center justify-center">
			<StatusPage
				code="404"
				title="Page not found"
				description="That page doesn't exist, or it may have moved."
				actions={
					<Button asChild>
						<Link to="/">Take me home</Link>
					</Button>
				}
			/>
		</div>
	);
}

function RootError({ error }: { error: Error }) {
	const router = useRouter();

	return (
		<div className="bg-background flex min-h-svh flex-col items-center justify-center">
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
							<Link to="/">Take me home</Link>
						</Button>
					</>
				}
			/>
		</div>
	);
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: APP_NAME },
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "icon", href: "/favicon.png", type: "image/png" },
		],
	}),
	notFoundComponent: RootNotFound,
	errorComponent: RootError,
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				<TooltipProvider>{children}</TooltipProvider>
				<TanStackDevtools
					config={{
						position: "bottom-right",
						// The bubble sits exactly over the tables' pagination
						// controls; fading it until hover keeps those clickable.
						hideUntilHover: true,
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
						TanStackQueryDevtools,
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
