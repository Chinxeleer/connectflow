import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth.ts";
import { resolveMemberScope } from "../scope.ts";
import { selectAssignablePeople, selectMembers } from "./query.ts";

/**
 * Scoping happens here, from the session — never from a client-supplied
 * parameter, which a leader could edit to read another leader's group.
 */
export const listMembers = createServerFn({ method: "GET" }).handler(
	async () => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const scope = await resolveMemberScope(session?.user);

		return await selectMembers(scope);
	},
);

export const membersQueryOptions = queryOptions({
	queryKey: ["members", "list"] as const,
	queryFn: () => listMembers(),
});

/**
 * Backs `LeaderPicker`/`MemberPicker` — everyone assignable, including
 * `isOrganization` rows that `listMembers` deliberately leaves out.
 */
export const listAssignablePeople = createServerFn({ method: "GET" }).handler(
	async () => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const scope = await resolveMemberScope(session?.user);

		return await selectAssignablePeople(scope);
	},
);

export const assignablePeopleQueryOptions = queryOptions({
	queryKey: ["members", "assignable"] as const,
	queryFn: () => listAssignablePeople(),
});
