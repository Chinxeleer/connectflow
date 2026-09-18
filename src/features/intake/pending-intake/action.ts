import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth.ts";
import { requireAdmin } from "@/lib/permissions.ts";
import {
	discardReconciliation,
	resolveReconciliationAsNew,
	resolveReconciliationAsUpdate,
	selectPendingIntakeReconciliations,
} from "./query.ts";
import {
	discardReconciliationSchema,
	resolveAsCreateNewSchema,
	resolveAsUpdateExistingSchema,
} from "./schema.ts";

/**
 * The review queue for intake submissions `matchPerson` couldn't confidently
 * resolve on its own. Admin-only — a leader has no use for a system-wide
 * ambiguity queue that spans everyone's connects.
 */
export const getPendingIntakeReconciliations = createServerFn({
	method: "GET",
}).handler(async () => {
	const { headers } = getRequest();
	const session = await auth.api.getSession({ headers });
	requireAdmin(session?.user);

	return await selectPendingIntakeReconciliations();
});

export const pendingIntakeReconciliationsQueryOptions = queryOptions({
	queryKey: ["staging", "needs-review"] as const,
	queryFn: () => getPendingIntakeReconciliations(),
});

export const resolveIntakeReconciliationAsUpdate = createServerFn({
	method: "POST",
})
	.validator(resolveAsUpdateExistingSchema)
	.handler(async ({ data }) => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const actor = requireAdmin(session?.user);

		await resolveReconciliationAsUpdate({
			reconciliationId: data.reconciliationId,
			personId: data.personId,
			patch: data.patch,
			actorId: actor.id,
		});

		return { ok: true } as const;
	});

export const resolveIntakeReconciliationAsNew = createServerFn({
	method: "POST",
})
	.validator(resolveAsCreateNewSchema)
	.handler(async ({ data }) => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const actor = requireAdmin(session?.user);

		await resolveReconciliationAsNew({
			reconciliationId: data.reconciliationId,
			actorId: actor.id,
		});

		return { ok: true } as const;
	});

export const discardIntakeReconciliation = createServerFn({ method: "POST" })
	.validator(discardReconciliationSchema)
	.handler(async ({ data }) => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const actor = requireAdmin(session?.user);

		await discardReconciliation({
			reconciliationId: data.reconciliationId,
			actorId: actor.id,
		});

		return { ok: true } as const;
	});
