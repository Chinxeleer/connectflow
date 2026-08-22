import { authClient } from "@/lib/auth-client.ts";
import type { SignInInput } from "./schema.ts";

/**
 * Credential sign-in. better-auth returns errors in the response rather than
 * throwing, so normalise to a thrown Error for the form to surface.
 */
export async function signIn({ email, password }: SignInInput): Promise<void> {
	const { error } = await authClient.signIn.email({ email, password });

	if (error) {
		throw new Error(
			error.message ??
				"We could not sign you in. Check your details and retry.",
		);
	}
}
