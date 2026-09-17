import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { intakeReconciliations } from "@/db/schema/intake-reconciliations.ts";
import { members } from "@/db/schema/members.ts";
import { memberIntakeSchema } from "@/features/intake/member-intake-webhook/index.ts";
import { auth } from "@/lib/auth.ts";
import { requireAdmin } from "@/lib/permissions.ts";
import { selectPendingIntakeReconciliations } from "./query.ts";
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

/**
 * Resolves a reconciliation by confirming it's the named candidate — applies
 * only the fields the caller included in `patch` (the will_add and any
 * use-new conflict fields; `name` is deliberately never part of this) and
 * marks the reconciliation resolved, atomically. The `status = 'pending'`
 * guard means a reconciliation already handled elsewhere (another admin, another
 * tab) fails the whole transaction rather than being resolved twice.
 */
export const resolveIntakeReconciliationAsUpdate = createServerFn({
	method: "POST",
})
	.validator(resolveAsUpdateExistingSchema)
	.handler(async ({ data }) => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const actor = requireAdmin(session?.user);

		await db.transaction(async (tx) => {
			if (Object.keys(data.patch).length > 0) {
				await tx
					.update(members)
					.set(data.patch)
					.where(eq(members.id, data.personId));
			}

			const [updated] = await tx
				.update(intakeReconciliations)
				.set({
					status: "resolved",
					resolution: "updated_existing",
					resolvedMemberId: data.personId,
					resolvedBy: actor.id,
					resolvedAt: new Date(),
				})
				.where(
					and(
						eq(intakeReconciliations.id, data.reconciliationId),
						eq(intakeReconciliations.status, "pending"),
					),
				)
				.returning({ id: intakeReconciliations.id });

			if (!updated) {
				throw new Error("That submission has already been handled.");
			}
		});

		return { ok: true } as const;
	});

/**
 * Resolves a reconciliation by creating a genuinely new person from the
 * original submission — re-validated through the same schema the webhook
 * itself used, since it's guaranteed to have already passed it once.
 */
export const resolveIntakeReconciliationAsNew = createServerFn({
	method: "POST",
})
	.validator(resolveAsCreateNewSchema)
	.handler(async ({ data }) => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const actor = requireAdmin(session?.user);

		const [reconciliation] = await db
			.select({ rawPayload: intakeReconciliations.rawPayload })
			.from(intakeReconciliations)
			.where(
				and(
					eq(intakeReconciliations.id, data.reconciliationId),
					eq(intakeReconciliations.status, "pending"),
				),
			);

		if (!reconciliation) {
			throw new Error("That submission has already been handled.");
		}

		const values = memberIntakeSchema.parse(reconciliation.rawPayload);

		await db.transaction(async (tx) => {
			const [created] = await tx
				.insert(members)
				.values({
					name: `${values.firstName} ${values.surname}`,
					leaderId: null,
					phone: values.phone,
					email: values.email,
					gender: values.gender,
					residence: values.residence,
					fieldOfStudy: values.fieldOfStudy,
					areaGroup: values.areaGroup,
					yearOfStudy: values.yearOfStudy,
					status: "new",
				})
				.returning({ id: members.id });

			if (!created) throw new Error("Failed to create that member.");

			const [updated] = await tx
				.update(intakeReconciliations)
				.set({
					status: "resolved",
					resolution: "created_new",
					resolvedMemberId: created.id,
					resolvedBy: actor.id,
					resolvedAt: new Date(),
				})
				.where(
					and(
						eq(intakeReconciliations.id, data.reconciliationId),
						eq(intakeReconciliations.status, "pending"),
					),
				)
				.returning({ id: intakeReconciliations.id });

			if (!updated) {
				throw new Error("That submission has already been handled.");
			}
		});

		return { ok: true } as const;
	});

/**
 * Discards a reconciliation as not applicable — spam, a duplicate, a
 * mistaken submission. No person record touched.
 */
export const discardIntakeReconciliation = createServerFn({ method: "POST" })
	.validator(discardReconciliationSchema)
	.handler(async ({ data }) => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const actor = requireAdmin(session?.user);

		const [updated] = await db
			.update(intakeReconciliations)
			.set({
				status: "resolved",
				resolution: "discarded",
				resolvedBy: actor.id,
				resolvedAt: new Date(),
			})
			.where(
				and(
					eq(intakeReconciliations.id, data.reconciliationId),
					eq(intakeReconciliations.status, "pending"),
				),
			)
			.returning({ id: intakeReconciliations.id });

		if (!updated) {
			throw new Error("That submission has already been handled.");
		}

		return { ok: true } as const;
	});
