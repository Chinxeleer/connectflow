import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth.ts";
import { resolveMemberScope } from "../scope.ts";
import { selectHierarchy } from "./query.ts";

/**
 * Scope comes from the session, never from a parameter — a leader editing the
 * request must not be able to root the tree at another leader's branch.
 */
export const getHierarchy = createServerFn({ method: "GET" }).handler(
	async () => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const scope = await resolveMemberScope(session?.user);

		return await selectHierarchy(scope);
	},
);

export const hierarchyQueryOptions = queryOptions({
	queryKey: ["members", "hierarchy"] as const,
	queryFn: () => getHierarchy(),
});
