import type { JsonValue } from "@/db/schema/intake-reconciliations.ts";
import { handleGoogleFormsWebhook } from "@/lib/webhook-route.ts";
import { upsertMemberFromIntake } from "./query.ts";
import { memberIntakeSchema } from "./schema.ts";

/**
 * Handles the "new member" Google Form's webhook call.
 *
 * Not a `createServerFn` — those are for the client's own RPC calls, resolved
 * through a session. This is a raw HTTP handler for an external caller with
 * no session at all, wired straight into the route's `server.handlers.POST`
 * the same way `auth.handler` is in `api/auth/$.ts`.
 */
export async function handleMemberIntakeWebhook(
	request: Request,
): Promise<Response> {
	return handleGoogleFormsWebhook(request, {
		source: "google_forms_member_intake",
		schema: memberIntakeSchema,
		handle: async (data, rawBody) => {
			// rawBody is JSON.parse's output, so it's always JSON-shaped by
			// construction — `unknown` here reflects JSON.parse's type, not doubt.
			const result = await upsertMemberFromIntake(data, rawBody as JsonValue);

			if (result.outcome === "created") {
				return {
					status: 201,
					body: { status: "created", memberId: result.memberId },
					reason: `created member ${result.memberId}`,
					memberId: result.memberId,
				};
			}

			if (result.outcome === "updated") {
				return {
					status: 200,
					body: { status: "updated", memberId: result.memberId },
					reason:
						result.backfilledFields.length > 0
							? `matched and updated member ${result.memberId}, backfilled: ${result.backfilledFields.join(", ")}`
							: `matched member ${result.memberId}, nothing missing to backfill`,
					memberId: result.memberId,
				};
			}

			return {
				status: 202,
				body: {
					status: "needs_review",
					reconciliationId: result.reconciliationId,
				},
				reason:
					result.candidateCount > 0
						? `staged for review (${result.reconciliationId}): ${result.candidateCount} candidate${result.candidateCount === 1 ? "" : "s"}`
						: `staged for review (${result.reconciliationId}): no matching candidates found`,
			};
		},
	});
}
