import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestUrl } from "@tanstack/react-start/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { auth } from "@/lib/auth.ts";
import { renderEmailLayout, sendEmail } from "@/lib/email-client.ts";
import { generateTemporaryPassword } from "@/lib/password.ts";
import { requireAdmin } from "@/lib/permissions.ts";
import { grantMemberAccessSchema } from "./schema.ts";

export type GrantAccessResult = {
	name: string;
	email: string;
	temporaryPassword: string;
	emailed: boolean;
};

/**
 * Creates a login account for an existing member and links it via
 * `members.userId` — the column `scope.ts` reads to decide what a signed-in
 * leader can see. Always granted the "leader" role: an admin who needs
 * another admin account uses `create-user` directly, which isn't tied to a
 * member row at all.
 *
 * Exported as a plain function, not just the `createServerFn` below, so
 * `features/leaders/grant-access` can grant to many members in one request
 * without an HTTP round trip per member — the caller is responsible for its
 * own `requireAdmin` check first, same as any other direct reuse in this
 * codebase.
 */
export async function grantAccessCore({
	memberId,
	email,
	headers,
	loginUrl,
}: {
	memberId: string;
	email: string;
	headers: Headers;
	loginUrl: string;
}): Promise<GrantAccessResult> {
	const [existing] = await db
		.select({ id: members.id, name: members.name, userId: members.userId })
		.from(members)
		.where(eq(members.id, memberId));

	if (!existing) {
		throw new Error("That member no longer exists.");
	}
	if (existing.userId) {
		throw new Error("This member already has a linked sign-in account.");
	}

	const temporaryPassword = generateTemporaryPassword();

	const created = await auth.api.createUser({
		body: {
			name: existing.name,
			email,
			password: temporaryPassword,
			role: "leader",
		},
		headers,
	});

	// `isNull(userId)` guards the same race the read above already narrowed:
	// if something else linked this member between the select and here, do
	// not silently overwrite it — the just-created login would be real but
	// orphaned, so it's removed rather than left dangling.
	const [linked] = await db
		.update(members)
		.set({ userId: created.user.id })
		.where(and(eq(members.id, memberId), isNull(members.userId)))
		.returning({ id: members.id });

	if (!linked) {
		await auth.api.removeUser({ body: { userId: created.user.id }, headers });
		throw new Error("This member already has a linked sign-in account.");
	}

	let emailed = true;
	try {
		await sendEmail({
			to: created.user.email,
			subject: "Your login details",
			html: renderEmailLayout({
				heading: `Welcome, ${existing.name}`,
				bodyHtml: `
					<p>You've been granted access to sign in. Here are your login details:</p>
					<p><strong>Email:</strong> ${created.user.email}<br>
					<strong>Temporary password:</strong> ${temporaryPassword}</p>
					<p>Use "Forgot your password?" on the login page any time to set your own.</p>
				`,
				action: { label: "Sign in", url: loginUrl },
			}),
		});
	} catch (error) {
		emailed = false;
		console.error("Failed to email granted credentials", error);
	}

	return {
		name: existing.name,
		email: created.user.email,
		temporaryPassword,
		emailed,
	};
}

export const grantMemberAccess = createServerFn({ method: "POST" })
	.validator(grantMemberAccessSchema)
	.handler(async ({ data }) => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		requireAdmin(session?.user);

		return grantAccessCore({
			memberId: data.memberId,
			email: data.email,
			headers,
			loginUrl: getRequestUrl().origin,
		});
	});
