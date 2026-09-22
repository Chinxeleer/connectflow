import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth.ts";
import { resolveMemberScope } from "../scope.ts";
import { selectMembersNeedingAttention } from "./query.ts";

export const listMembersNeedingAttention = createServerFn({
	method: "GET",
}).handler(async () => {
	const { headers } = getRequest();
	const session = await auth.api.getSession({ headers });
	const scope = await resolveMemberScope(session?.user);

	return await selectMembersNeedingAttention(scope);
});

export const needsAttentionQueryOptions = queryOptions({
	queryKey: ["members", "needs-attention"] as const,
	queryFn: () => listMembersNeedingAttention(),
});
