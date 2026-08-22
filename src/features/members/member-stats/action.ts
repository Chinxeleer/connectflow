import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth.ts";
import { resolveMemberScope } from "../scope.ts";
import { selectMemberStats } from "./query.ts";

export const getMemberStats = createServerFn({ method: "GET" }).handler(
	async () => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const scope = await resolveMemberScope(session?.user);

		return await selectMemberStats(scope);
	},
);

export const memberStatsQueryOptions = queryOptions({
	queryKey: ["members", "stats"] as const,
	queryFn: () => getMemberStats(),
});
