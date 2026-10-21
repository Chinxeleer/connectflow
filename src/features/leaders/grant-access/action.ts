import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { grantAccessCore } from "@/features/members/grant-member-access/index.ts";
import { resolveMemberScope } from "@/features/members/scope.ts";
import { auth } from "@/lib/auth.ts";
import { requireAdmin } from "@/lib/permissions.ts";
import { selectLeadersWithoutAccess } from "./query.ts";

export type BulkGrantAccessResult = {
	granted: Array<{ name: string; email: string }>;
	failed: Array<{ name: string; error: string }>;
};

/**
 * Grants access to every leader in scope who has no login yet and does have
 * an email on file — one `grantAccessCore` call per member, run in sequence
 * so one failure (a since-taken email, a transient DB hiccup) doesn't abort
 * the rest; each outcome is reported back rather than the whole batch
 * living or dying together.
 */
export const grantAccessToAllLeaders = createServerFn({
	method: "POST",
}).handler(async (): Promise<BulkGrantAccessResult> => {
	const { headers } = getRequest();
	const session = await auth.api.getSession({ headers });
	requireAdmin(session?.user);
	const scope = await resolveMemberScope(session?.user);

	const candidates = await selectLeadersWithoutAccess(scope);

	const granted: BulkGrantAccessResult["granted"] = [];
	const failed: BulkGrantAccessResult["failed"] = [];

	for (const candidate of candidates) {
		if (!candidate.email) continue;
		try {
			const result = await grantAccessCore({
				memberId: candidate.id,
				email: candidate.email,
				headers,
			});
			granted.push({ name: result.name, email: result.email });
		} catch (error) {
			failed.push({
				name: candidate.name,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	return { granted, failed };
});
