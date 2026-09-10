import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth.ts";
import { requireAdmin } from "@/lib/permissions.ts";
import { selectAreaGroupStats } from "./query.ts";

/**
 * People and connects per area group, org-wide.
 *
 * Admin-only: unlike the members list and the dashboard cards, this is not
 * scoped to a leader's own connects — it rolls up every area across the whole
 * membership, which is exactly the view a leader is not meant to have. Gated
 * here, not just by hiding the nav tab.
 */
export const getAreaGroupStats = createServerFn({ method: "GET" }).handler(
	async () => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		requireAdmin(session?.user);

		return await selectAreaGroupStats();
	},
);

export const areaGroupStatsQueryOptions = queryOptions({
	queryKey: ["members", "area-group-stats"] as const,
	queryFn: () => getAreaGroupStats(),
});
