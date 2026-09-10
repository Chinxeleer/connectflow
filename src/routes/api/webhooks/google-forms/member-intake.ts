import { createFileRoute } from "@tanstack/react-router";
import { handleMemberIntakeWebhook } from "@/features/intake/member-intake-webhook/index.ts";

/**
 * Not session-authenticated — verified by the shared secret checked inside
 * `handleMemberIntakeWebhook`, since the caller (the Apps Script trigger on
 * the "new member" form) has no user session. A signed-in user hitting this
 * route directly still has to clear that same check; there is no session
 * bypass here.
 */
export const Route = createFileRoute(
	"/api/webhooks/google-forms/member-intake",
)({
	server: {
		handlers: {
			POST: ({ request }) => handleMemberIntakeWebhook(request),
		},
	},
});
