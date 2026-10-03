import { authClient } from "@/lib/auth-client.ts";
import type { ForgotPasswordInput } from "./schema.ts";

/**
 * Always resolves, even for an email with no account — better-auth responds
 * identically either way so the form can't be used to probe which emails
 * are registered.
 */
export async function requestPasswordReset({
	email,
}: ForgotPasswordInput): Promise<void> {
	const { error } = await authClient.requestPasswordReset({
		email,
		redirectTo: "/reset-password",
	});

	if (error) {
		throw new Error(error.message ?? "Something went wrong. Please try again.");
	}
}
