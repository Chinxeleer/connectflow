import { and, asc, isNull } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";

/**
 * Everyone without a connect leader — the same "Without a Connect" bucket
 * the dashboard counts, turned into an actionable list. Excludes removed
 * members: they don't need a leader, they need nothing.
 */
export async function selectUnassignedMembers() {
	return db
		.select({
			id: members.id,
			name: members.name,
			phone: members.phone,
			email: members.email,
			areaGroup: members.areaGroup,
			status: members.status,
			createdAt: members.createdAt,
		})
		.from(members)
		.where(and(isNull(members.leaderId), isNull(members.removedAt)))
		.orderBy(asc(members.createdAt));
}

export type UnassignedMemberRow = Awaited<
	ReturnType<typeof selectUnassignedMembers>
>[number];
