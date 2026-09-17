import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth.ts";
import { requireAdmin } from "@/lib/permissions.ts";
import { selectUnassignedMembers } from "./query.ts";

/**
 * Staging's "Unassigned" list. Admin-only — a leader is already scoped to
 * their own connect and has no use for a system-wide unassigned queue.
 */
export const getUnassignedMembers = createServerFn({ method: "GET" }).handler(
	async () => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		requireAdmin(session?.user);

		return await selectUnassignedMembers();
	},
);

export const unassignedMembersQueryOptions = queryOptions({
	queryKey: ["staging", "unassigned"] as const,
	queryFn: () => getUnassignedMembers(),
});
