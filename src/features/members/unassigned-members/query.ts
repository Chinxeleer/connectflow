import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";

/**
 * Everyone without a connect leader — the same "Without a Connect" bucket
 * the dashboard counts, turned into an actionable list. Excludes removed
 * members: they don't need a leader, they need nothing. Also excludes
 * `isOrganization` rows (e.g. "ENC") — they're a valid leader *target*, not
 * someone waiting to be assigned one; they always have `leaderId: null` by
 * design, so without this they'd sit here forever as unactionable noise.
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
		.where(
			and(
				isNull(members.leaderId),
				isNull(members.removedAt),
				eq(members.isOrganization, false),
			),
		)
		.orderBy(asc(members.createdAt));
}

export type UnassignedMemberRow = Awaited<
	ReturnType<typeof selectUnassignedMembers>
>[number];
