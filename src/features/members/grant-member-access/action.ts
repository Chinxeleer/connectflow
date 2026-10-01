import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { auth } from "@/lib/auth.ts";
import { generateTemporaryPassword } from "@/lib/password.ts";
import { requireAdmin } from "@/lib/permissions.ts";
import { grantMemberAccessSchema } from "./schema.ts";

/**
 * Creates a login account for an existing member and links it via
 * `members.userId` — the column `scope.ts` reads to decide what a signed-in
 * leader can see. Always granted the "leader" role: an admin who needs
 * another admin account uses `create-user` directly, which isn't tied to a
 * member row at all.
 */
export const grantMemberAccess = createServerFn({ method: "POST" })
	.validator(grantMemberAccessSchema)
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
		if (existing.userId) {
			throw new Error("This member already has a linked sign-in account.");
		}

		const temporaryPassword = generateTemporaryPassword();

		const created = await auth.api.createUser({
			body: {
				name: existing.name,
				email: data.email,
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
			.where(and(eq(members.id, data.memberId), isNull(members.userId)))
			.returning({ id: members.id });

		if (!linked) {
			await auth.api.removeUser({ body: { userId: created.user.id }, headers });
			throw new Error("This member already has a linked sign-in account.");
		}

		return {
			name: existing.name,
			email: created.user.email,
			temporaryPassword,
		};
	});
