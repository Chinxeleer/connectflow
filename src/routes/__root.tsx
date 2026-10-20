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

/**
 * Applies the stored theme before first paint — must run synchronously,
 * ahead of React hydration, or a dark-mode visitor sees a flash of the light
 * theme. Kept deliberately simple (no import from theme-store.ts, which
 * can't run yet) and in sync with that file's own `readStoredTheme`/
 * `applyTheme` by hand.
 */
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem("theme");var dark=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(dark)document.documentElement.classList.add("dark");}catch(e){}})();`;

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, author-controlled script with no user input — see THEME_INIT_SCRIPT's own comment for why it must be inline */}
				<script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
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
