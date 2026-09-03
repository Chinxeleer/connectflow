import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { auth } from "@/lib/auth.ts";
import { requireActor } from "@/lib/permissions.ts";
import {
	ancestorMemberIdsFor,
	inDownlineOf,
	resolveMemberScope,
} from "../scope.ts";
import {
	memberProfilePermissions,
	type ProfileFieldPermissions,
} from "../update-member-profile/guard.ts";
import { type MemberDetail, selectMemberDetail } from "./query.ts";

export const memberDetailSchema = z.object({
	memberId: z.uuid("Expected a member id."),
});

export type MemberDetailResult =
	| { status: "ok"; member: MemberDetail; permissions: ProfileFieldPermissions }
	| { status: "not-found" }
	| { status: "forbidden" };

/**
 * One member's profile, if the caller may see it.
 *
 * Viewing follows the hierarchy: a leader may open anyone in their downline, so
 * every node the tree renders for them is a live link rather than a dead one.
 * Editing is narrower and decided separately — `permissions` says which fields
 * this caller may actually change.
 *
 * Returns a union rather than throwing, unlike the admin-only read on /users.
 * "This profile is not yours" is a legitimate page state, not an exception: a
 * thrown error loses its class crossing the server boundary, which would leave
 * the client string-matching a message to decide what to render. Nothing about
 * a forbidden member is returned either way. Writes still throw — a form needs
 * something to catch.
 */
export const getMemberDetail = createServerFn({ method: "GET" })
	.validator(memberDetailSchema)
	.handler(async ({ data }): Promise<MemberDetailResult> => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const actor = requireActor(session?.user);
		const scope = await resolveMemberScope(actor);

		const member = await selectMemberDetail(data.memberId);
		if (!member) return { status: "not-found" };

		if (scope.kind !== "all") {
			// Only walked when the cheap checks inside `inDownlineOf` cannot
			// settle it — an admin and a leader's own rows never get here.
			const ancestors = scope.memberIds.includes(data.memberId)
				? []
				: await ancestorMemberIdsFor(data.memberId);

			if (!inDownlineOf(scope, data.memberId, ancestors)) {
				return { status: "forbidden" };
			}
		}

		return {
			status: "ok",
			member,
			permissions: memberProfilePermissions({
				actor,
				memberId: member.id,
				memberLeaderId: member.leaderId,
				linkedMemberIds: scope.kind === "all" ? [] : scope.memberIds,
			}),
		};
	});

export const memberDetailQueryOptions = (memberId: string) =>
	queryOptions({
		queryKey: ["members", "detail", memberId] as const,
		queryFn: () => getMemberDetail({ data: { memberId } }),
	});
