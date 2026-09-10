import { createFileRoute } from "@tanstack/react-router";
import { handleMemberRemovalWebhook } from "@/features/intake/member-removal-webhook/index.ts";

/**
 * Not session-authenticated — see the note in `member-intake.ts`. Same
 * shared-secret check, same guarantee: nothing here trusts a cookie.
 */
export const Route = createFileRoute(
	"/api/webhooks/google-forms/member-removal",
)({
	server: {
		handlers: {
			POST: ({ request }) => handleMemberRemovalWebhook(request),
		},
	},
});
