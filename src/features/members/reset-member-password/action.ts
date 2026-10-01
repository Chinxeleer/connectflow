import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { user } from "@/db/schema/auth.ts";
import { members } from "@/db/schema/members.ts";
import { auth } from "@/lib/auth.ts";
import { generateTemporaryPassword } from "@/lib/password.ts";
import { requireAdmin } from "@/lib/permissions.ts";
import { resetMemberPasswordSchema } from "./schema.ts";

/**
 * Regenerates the password for a member's already-linked login — the
 * original temporary password is never stored anywhere after it's shown
 * once, so this is the only recovery path for "they lost it before they
 * could sign in" or "they forgot it and there's no password-reset email yet".
 */
export const resetMemberPassword = createServerFn({ method: "POST" })
	.validator(resetMemberPasswordSchema)
	.handler(async ({ data }) => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		requireAdmin(session?.user);

		const [existing] = await db
			.select({ id: members.id, name: members.name, userId: members.userId })
			.from(members)
			.where(eq(members.id, data.memberId));

		if (!existing) {
			throw new Error("That member no longer exists.");
		}
		if (!existing.userId) {
			throw new Error("This member has no linked sign-in account yet.");
		}

		const [account] = await db
			.select({ email: user.email })
			.from(user)
			.where(eq(user.id, existing.userId));

		if (!account) {
			throw new Error("Could not find that member's account.");
		}

		const temporaryPassword = generateTemporaryPassword();

		await auth.api.setUserPassword({
			body: { userId: existing.userId, newPassword: temporaryPassword },
			headers,
		});

		return {
			name: existing.name,
			email: account.email,
			temporaryPassword,
		};
	});
