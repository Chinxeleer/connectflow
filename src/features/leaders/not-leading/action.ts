import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { sql } from "drizzle-orm";
import { members } from "@/db/schema/members.ts";
import {
	type MemberListRow,
	selectMembers,
} from "@/features/members/member-list/query.ts";
import { resolveMemberScope } from "@/features/members/scope.ts";
import { auth } from "@/lib/auth.ts";
import { selectNotLeadingOverview } from "./query.ts";

// Same predicate `not-leading/query.ts` uses for the stats — kept in sync by
// literally reusing `member-list`'s `selectMembers`, which already carries
// the scope/isOrganization filtering this list needs too.
const notLeading = sql`not exists (
	select 1 from ${members} as report where report.leader_id = ${members}.id
)`;

export const getNotLeadingOverview = createServerFn({ method: "GET" }).handler(
	async () => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const scope = await resolveMemberScope(session?.user);

		return await selectNotLeadingOverview(scope);
	},
);

export const notLeadingOverviewQueryOptions = queryOptions({
	queryKey: ["leaders", "not-leading", "overview"] as const,
	queryFn: () => getNotLeadingOverview(),
});

export const listNotLeadingMembers = createServerFn({
	method: "GET",
}).handler(async (): Promise<MemberListRow[]> => {
	const { headers } = getRequest();
	const session = await auth.api.getSession({ headers });
	const scope = await resolveMemberScope(session?.user);

	return await selectMembers(scope, notLeading);
});

export const notLeadingMembersQueryOptions = queryOptions({
	queryKey: ["leaders", "not-leading", "members"] as const,
	queryFn: () => listNotLeadingMembers(),
});
