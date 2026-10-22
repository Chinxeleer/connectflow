import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { count, eq } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { user } from "@/db/schema/auth.ts";
import { auth } from "@/lib/auth.ts";
import { requireAdmin } from "@/lib/permissions.ts";
import { setUserRoleSchema } from "./schema.ts";

/**
 * Promotes a leader to admin, or demotes an admin back to leader — the only
 * two roles that exist. Two guards an admin can't route around from the UI:
 * you can't change your own role (no self-lockout, and no accidentally
 * demoting yourself mid-session), and the last remaining admin can't be
 * demoted at all (there is no recovery path for a system with zero admins —
 * every other admin-granting action requires one already existing).
 */
export const setUserRole = createServerFn({ method: "POST" })
	.validator(setUserRoleSchema)
	.handler(async ({ data }) => {
		const { headers } = getRequest();
		const session = await auth.api.getSession({ headers });
		const actor = requireAdmin(session?.user);

		if (actor.id === data.userId) {
			throw new Error("You can't change your own role.");
		}

		const [target] = await db
			.select({ role: user.role })
			.from(user)
			.where(eq(user.id, data.userId));

		if (!target) {
			throw new Error("That account no longer exists.");
		}

		if (target.role === "admin" && data.role === "leader") {
			const [row] = await db
				.select({ adminCount: count() })
				.from(user)
				.where(eq(user.role, "admin"));

			if ((row?.adminCount ?? 0) <= 1) {
				throw new Error("There must always be at least one admin.");
			}
		}

		await auth.api.setRole({
			body: { userId: data.userId, role: data.role },
			headers,
		});
	});
