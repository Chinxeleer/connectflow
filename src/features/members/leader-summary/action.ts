import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth.ts";
import { resolveMemberScope } from "../scope.ts";
import { selectConnectLeaders } from "./query.ts";

export const listConnectLeaders = createServerFn({ method: "GET" }).handler(
	async () => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const scope = await resolveMemberScope(session?.user);

		return await selectConnectLeaders(scope);
	},
);

export const connectLeadersQueryOptions = queryOptions({
	queryKey: ["members", "leaders"] as const,
	queryFn: () => listConnectLeaders(),
});
