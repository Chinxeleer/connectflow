import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { pendingRemovals } from "@/db/schema/pending-removals.ts";
import { auth } from "@/lib/auth.ts";
import { requireAdmin } from "@/lib/permissions.ts";
import { selectPendingRemovals } from "./query.ts";
import {
	dismissPendingRemovalSchema,
	resolvePendingRemovalSchema,
} from "./schema.ts";

/**
 * The review queue. Admin-only — this crosses every removal request in the
 * system, the same reason the areas stats are admin-only, and there is no
 * "my requests" scoping that would make sense for a leader here.
 */
export const getPendingRemovals = createServerFn({ method: "GET" }).handler(
	async () => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		requireAdmin(session?.user);

		return await selectPendingRemovals();
	},
);

export const pendingRemovalsQueryOptions = queryOptions({
	queryKey: ["pending-removals"] as const,
	queryFn: () => getPendingRemovals(),
});

/**
 * Resolves an ambiguous or unmatched removal request by picking the member it
 * actually refers to. Both writes happen in one transaction, guarded by a
 * `status = 'pending'` condition on the update — if the row was already
 * handled (by another admin, in another tab), the guarded update affects zero
 * rows and the whole transaction rolls back rather than soft-deleting a
 * member a second time.
 */
export const resolvePendingRemoval = createServerFn({ method: "POST" })
	.validator(resolvePendingRemovalSchema)
	.handler(async ({ data }) => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const actor = requireAdmin(session?.user);

		await db.transaction(async (tx) => {
			await tx
				.update(members)
				.set({ status: "inactive", removedAt: new Date() })
				.where(eq(members.id, data.memberId));

			const [updated] = await tx
				.update(pendingRemovals)
				.set({
					status: "resolved",
					resolvedMemberId: data.memberId,
					resolvedBy: actor.id,
					resolvedAt: new Date(),
				})
				.where(
					and(
						eq(pendingRemovals.id, data.pendingRemovalId),
						eq(pendingRemovals.status, "pending"),
					),
				)
				.returning({ id: pendingRemovals.id });

			if (!updated) {
				throw new Error("That removal request has already been handled.");
			}
		});

		return { ok: true } as const;
	});

/**
 * Dismisses a removal request as not applicable — a typo, a duplicate
 * submission, spam. No member record is touched.
 */
export const dismissPendingRemoval = createServerFn({ method: "POST" })
	.validator(dismissPendingRemovalSchema)
	.handler(async ({ data }) => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const actor = requireAdmin(session?.user);

		const [updated] = await db
			.update(pendingRemovals)
			.set({
				status: "dismissed",
				resolvedBy: actor.id,
				resolvedAt: new Date(),
			})
			.where(
				and(
					eq(pendingRemovals.id, data.pendingRemovalId),
					eq(pendingRemovals.status, "pending"),
				),
			)
			.returning({ id: pendingRemovals.id });

		if (!updated) {
			throw new Error("That removal request has already been handled.");
		}

		return { ok: true } as const;
	});
