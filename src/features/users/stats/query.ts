import { count, gte, sql } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { user } from "@/db/schema/auth.ts";

/**
 * Headline counts for the dashboard cards. One round trip — these are
 * aggregate counts over the whole table, so there is nothing to scope per
 * leader; the caller is admin-only regardless (see `action.ts`).
 */
export async function selectUserStats() {
	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

	const [row] = await db
		.select({
			total: count(),
			admins:
				sql<number>`count(*) filter (where ${user.role} = 'admin')`.mapWith(
					Number,
				),
			leaders:
				sql<number>`count(*) filter (where ${user.role} = 'leader')`.mapWith(
					Number,
				),
			addedThisWeek: sql<number>`count(*) filter (where ${gte(
				user.createdAt,
				sevenDaysAgo,
			)})`.mapWith(Number),
		})
		.from(user);

	return row ?? { total: 0, admins: 0, leaders: 0, addedThisWeek: 0 };
}

export type UserStats = Awaited<ReturnType<typeof selectUserStats>>;
