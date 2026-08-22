import { desc } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { user } from "@/db/schema/auth.ts";

/**
 * Every account, newest first. Callers must be admins — enforced in
 * `action.ts`, since leaders have no business seeing the full roster.
 *
 * Selects columns explicitly rather than `select()`: `banReason`/`banExpires`
 * and friends have no place in a list view.
 */
export function selectAllUsers() {
	return db
		.select({
			id: user.id,
			name: user.name,
			email: user.email,
			role: user.role,
			createdAt: user.createdAt,
		})
		.from(user)
		.orderBy(desc(user.createdAt));
}

export type UserListRow = Awaited<ReturnType<typeof selectAllUsers>>[number];
