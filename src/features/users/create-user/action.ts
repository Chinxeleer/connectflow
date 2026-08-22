import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { auth } from "@/lib/auth.ts";
import { generateTemporaryPassword } from "@/lib/password.ts";
import { requireAdmin } from "@/lib/permissions.ts";
import { createUserSchema } from "./schema.ts";

/**
 * Admin-only account creation — the only way an account comes into existence,
 * since there is no public sign-up route.
 *
 * The permission check runs here rather than relying on the dashboard hiding
 * the form. `auth.api.createUser` independently re-checks that the caller is
 * an admin, so the guard is defence in depth, not the only gate.
 *
 * The generated password is returned to the calling admin exactly once and is
 * never stored in plaintext — better-auth hashes it on the way in.
 */
export const createUser = createServerFn({ method: "POST" })
	.validator(createUserSchema)
	.handler(async ({ data }) => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });

		requireAdmin(session?.user);

		const temporaryPassword = generateTemporaryPassword();

		const created = await auth.api.createUser({
			body: {
				name: data.name,
				email: data.email,
				password: temporaryPassword,
				role: data.role,
			},
			headers,
		});

		return {
			id: created.user.id,
			name: data.name,
			email: created.user.email,
			temporaryPassword,
		};
	});
