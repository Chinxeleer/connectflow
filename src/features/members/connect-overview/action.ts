import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth.ts";
import { resolveMemberScope } from "../scope.ts";
import { selectConnectOverview } from "./query.ts";

export const getConnectOverview = createServerFn({ method: "GET" }).handler(
	async () => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const scope = await resolveMemberScope(session?.user);

		return await selectConnectOverview(scope);
	},
);

export const connectOverviewQueryOptions = queryOptions({
	queryKey: ["members", "connect-overview"] as const,
	queryFn: () => getConnectOverview(),
});
