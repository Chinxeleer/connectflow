import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth.ts";
import { requireAdmin } from "@/lib/permissions.ts";
import { selectUserStats } from "./query.ts";

export const getUserStats = createServerFn({ method: "GET" }).handler(
	async () => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });

		requireAdmin(session?.user);

		return await selectUserStats();
	},
);

export const userStatsQueryOptions = queryOptions({
	queryKey: ["users", "stats"] as const,
	queryFn: () => getUserStats(),
});
