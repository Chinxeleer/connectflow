import { handleGoogleFormsWebhook } from "@/lib/webhook-route.ts";
import { findNameMatches } from "./match.ts";
import {
	insertPendingRemoval,
	selectRemovalCandidates,
	softDeleteMember,
} from "./query.ts";
import { memberRemovalSchema } from "./schema.ts";

/**
 * Handles the "remove a member" Google Form's webhook call.
 *
 * Not a `createServerFn` — see the note in `member-intake-webhook/action.ts`.
 * A person record is only ever touched on exactly one match; zero or several
 * always falls through to `pending_removals` for a human to resolve.
 */
export async function handleMemberRemovalWebhook(
	request: Request,
): Promise<Response> {
	return handleGoogleFormsWebhook(request, {
		source: "google_forms_member_removal",
		schema: memberRemovalSchema,
		handle: async (data) => {
			const candidates = await selectRemovalCandidates();
			const matches = findNameMatches(candidates, data.firstName, data.surname);

			if (matches.length === 1) {
				// biome-ignore lint/style/noNonNullAssertion: length === 1 by the check above
				const match = matches[0]!;
				await softDeleteMember(match.id);

				return {
					status: 200,
					body: { status: "removed", memberId: match.id },
					reason: `matched and marked inactive: ${match.name}`,
					memberId: match.id,
				};
			}

			await insertPendingRemoval({
				firstName: data.firstName,
				surname: data.surname,
				submittedAt: data.submittedAt,
			});

			return {
				status: 202,
				body: { status: "pending_review" },
				reason:
					matches.length === 0
						? `no matching member found for "${data.firstName} ${data.surname}"`
						: `ambiguous: ${matches.length} members matched "${data.firstName} ${data.surname}"`,
			};
		},
	});
}
