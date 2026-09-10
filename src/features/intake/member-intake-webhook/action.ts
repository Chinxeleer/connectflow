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
		handle: async (data) => {
			const result = await upsertMemberFromIntake(data);

			return {
				status: result.created ? 201 : 200,
				body: { status: "ok", memberId: result.id, created: result.created },
				reason: result.created
					? `created member ${result.id}`
					: `updated existing member ${result.id} (matched by email)`,
				memberId: result.id,
			};
		},
	});
}
