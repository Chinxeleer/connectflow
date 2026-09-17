import { matchPersonForRemoval } from "@/lib/person-matching.ts";
import { handleGoogleFormsWebhook } from "@/lib/webhook-route.ts";
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
 * A person record is only ever touched on an exact, unambiguous name match
 * (`matchPersonForRemoval`'s `EXACT_MATCH`); anything else — several exact
 * matches, a fuzzy-but-not-exact match, or nothing at all — always falls
 * through to `pending_removals` for a human to resolve, even when there's
 * exactly one fuzzy candidate. Guessing wrong here soft-deletes an innocent
 * person, so this stays stricter than the intake webhook's tolerance.
 */
export async function handleMemberRemovalWebhook(
	request: Request,
): Promise<Response> {
	return handleGoogleFormsWebhook(request, {
		source: "google_forms_member_removal",
		schema: memberRemovalSchema,
		handle: async (data) => {
			const candidates = await selectRemovalCandidates();
			const match = matchPersonForRemoval(
				{ firstName: data.firstName, surname: data.surname },
				candidates,
			);

			if (match.outcome === "EXACT_MATCH") {
				await softDeleteMember(match.personId);

				return {
					status: 200,
					body: { status: "removed", memberId: match.personId },
					reason: `exact match, marked inactive: ${match.personId}`,
					memberId: match.personId,
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
					match.candidates.length === 0
						? `no matching member found for "${data.firstName} ${data.surname}"`
						: `${match.candidates.length} candidate(s) for "${data.firstName} ${data.surname}": ${match.candidates.map((c) => c.matchReason).join("; ")}`,
			};
		},
	});
}
