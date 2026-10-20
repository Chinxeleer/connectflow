import { authClient } from "@/lib/auth-client.ts";
import type { ChangePasswordInput } from "./schema.ts";

/**
 * Changes the signed-in user's own password — distinct from
 * `reset-member-password` (an admin acting on someone else who's locked
 * out) and `reset-password` (a logged-out self-service recovery). This is
 * for someone who's already in and just wants a different password.
 * Revokes other sessions: a password change is exactly the moment an old,
 * possibly-compromised session should stop being valid.
 */
export async function changePassword({
	currentPassword,
	newPassword,
}: ChangePasswordInput): Promise<void> {
	const { error } = await authClient.changePassword({
		currentPassword,
		newPassword,
		revokeOtherSessions: true,
	});

	if (error) {
		throw new Error(
			error.message ?? "Could not change your password. Please try again.",
		);
	}
}
