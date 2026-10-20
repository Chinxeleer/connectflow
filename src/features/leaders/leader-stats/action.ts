import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { resolveMemberScope } from "@/features/members/scope.ts";
import { auth } from "@/lib/auth.ts";
import { selectLeaderStats } from "./query.ts";

export const getLeaderStats = createServerFn({ method: "GET" }).handler(
	async () => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const scope = await resolveMemberScope(session?.user);

		return await selectLeaderStats(scope);
	},
);

export const leaderStatsQueryOptions = queryOptions({
	queryKey: ["leaders", "stats"] as const,
	queryFn: () => getLeaderStats(),
});
