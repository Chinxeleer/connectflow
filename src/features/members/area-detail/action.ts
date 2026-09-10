import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { type AreaGroup, areaGroup, members } from "@/db/schema/members.ts";
import { auth } from "@/lib/auth.ts";
import { requireAdmin } from "@/lib/permissions.ts";
import { type MemberListRow, selectMembers } from "../member-list/query.ts";
import { type AreaOverview, selectAreaOverview } from "./query.ts";

const areaDetailSchema = z.object({
	areaGroup: z.enum(areaGroup.enumValues),
});

/**
 * One area group's stats and roster. Admin-only, same as the areas overview
 * page — a leader is scoped to their own connects, not to a slice of every
 * leader's people that happens to share a residence area.
 */
export const getAreaOverview = createServerFn({ method: "GET" })
	.validator(areaDetailSchema)
	.handler(async ({ data }): Promise<AreaOverview> => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		requireAdmin(session?.user);

		return await selectAreaOverview(data.areaGroup);
	});

export const getAreaMembers = createServerFn({ method: "GET" })
	.validator(areaDetailSchema)
	.handler(async ({ data }): Promise<MemberListRow[]> => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		requireAdmin(session?.user);

		return await selectMembers(
			{ kind: "all" },
			eq(members.areaGroup, data.areaGroup),
		);
	});

export const areaOverviewQueryOptions = (group: AreaGroup) =>
	queryOptions({
		queryKey: ["members", "area-detail", group, "overview"] as const,
		queryFn: () => getAreaOverview({ data: { areaGroup: group } }),
	});

export const areaMembersQueryOptions = (group: AreaGroup) =>
	queryOptions({
		queryKey: ["members", "area-detail", group, "members"] as const,
		queryFn: () => getAreaMembers({ data: { areaGroup: group } }),
	});
