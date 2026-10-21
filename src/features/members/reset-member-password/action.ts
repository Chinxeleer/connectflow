import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { user } from "@/db/schema/auth.ts";
import { members } from "@/db/schema/members.ts";
import { getAppUrl } from "@/lib/app.ts";
import { auth } from "@/lib/auth.ts";
import { renderEmailLayout, sendEmail } from "@/lib/email-client.ts";
import { generateTemporaryPassword } from "@/lib/password.ts";
import { requireAdmin } from "@/lib/permissions.ts";
import { resetMemberPasswordSchema } from "./schema.ts";

/**
 * Regenerates the password for a member's already-linked login — the
 * original temporary password is never stored anywhere after it's shown
 * once, so this is an admin's way to recover someone who lost theirs before
 * they could sign in. (Someone who remembers their email but not their
 * password should use "Forgot your password?" on the login page instead —
 * this is for when they're locked out entirely.)
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

		let emailed = true;
		try {
			await sendEmail({
				to: account.email,
				subject: "Your password has been reset",
				html: renderEmailLayout({
					heading: `${existing.name}, your password was reset`,
					bodyHtml: `
						<p>An admin reset your password. Here's your new temporary one:</p>
						<p><strong>Temporary password:</strong> ${temporaryPassword}</p>
						<p>If this wasn't expected, let an admin know.</p>
					`,
					action: { label: "Sign in", url: getAppUrl() },
				}),
			});
		} catch (error) {
			emailed = false;
			console.error("Failed to email reset credentials", error);
		}

		return {
			name: existing.name,
			email: account.email,
			temporaryPassword,
			emailed,
		};
	});
