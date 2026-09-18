import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth.ts";
import { requireAdmin } from "@/lib/permissions.ts";
import { selectStagingAttentionCount } from "./query.ts";

/**
 * Backs the Staging nav item's notification badge. Admin-only, same gate as
 * every Staging page — a leader has no Staging section to be notified about.
 */
export const getStagingAttentionCount = createServerFn({
	method: "GET",
}).handler(async () => {
	const { headers } = getRequest();
	const session = await auth.api.getSession({ headers });
	requireAdmin(session?.user);

	return await selectStagingAttentionCount();
});

export const stagingAttentionQueryOptions = queryOptions({
	queryKey: ["staging", "attention"] as const,
	queryFn: () => getStagingAttentionCount(),
});
