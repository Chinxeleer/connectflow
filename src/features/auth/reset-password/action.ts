import { authClient } from "@/lib/auth-client.ts";

/**
 * Sets a new password from a reset-link token. better-auth's own endpoint
 * validates the token (exists, unexpired, unused) — there is no separate
 * check here.
 */
export async function resetPassword({
	newPassword,
	token,
}: {
	newPassword: string;
	token: string;
}): Promise<void> {
	const { error } = await authClient.resetPassword({ newPassword, token });

	if (error) {
		throw new Error(
			error.message ??
				"That reset link is invalid or has expired. Request a new one.",
		);
	}
}
