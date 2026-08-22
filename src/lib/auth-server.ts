import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth, type Session } from "./auth.ts";

/**
 * Reads the current better-auth session on the server. Safe to import from
 * route files — the handler body is stripped from the client bundle.
 */
export const fetchSession = createServerFn({ method: "GET" }).handler(
	async (): Promise<Session | null> => {
		const { headers } = getRequest();
		return await auth.api.getSession({ headers });
	},
);

/**
 * Cached through the router's `queryClient` so a navigation does not re-hit the
 * server for every route match. Invalidate this key after sign-in/sign-out.
 */
export const sessionQueryOptions = queryOptions({
	queryKey: ["auth", "session"] as const,
	queryFn: () => fetchSession(),
	staleTime: 60 * 1000,
});
