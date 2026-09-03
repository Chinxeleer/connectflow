import { asc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";

const leader = alias(members, "leader");

/** Whether this member can sign in — the link that scopes a leader. */
const hasAccount = sql<boolean>`(${members.userId} is not null)`.mapWith(
	Boolean,
);

/**
 * One member in full, with their leader's name resolved and the people who
 * report directly to them named — the profile answers "what is this person
 * carrying", not how big their whole branch is, so this stays direct-only.
 *
 * Deliberately unscoped: permission is the caller's job, exactly as
 * `run-import.ts` documents for itself. `member-detail/action.ts` decides who
 * may see this, and nothing else may call it without doing the same.
 */
export async function selectMemberDetail(memberId: string) {
	const [row] = await db
		.select({
			id: members.id,
			name: members.name,
			phone: members.phone,
			email: members.email,
			gender: members.gender,
			residence: members.residence,
			fieldOfStudy: members.fieldOfStudy,
			status: members.status,
			leaderId: members.leaderId,
			leaderName: leader.name,
			hasAccount,
			createdAt: members.createdAt,
			updatedAt: members.updatedAt,
		})
		.from(members)
		.leftJoin(leader, eq(members.leaderId, leader.id))
		.where(eq(members.id, memberId));

	if (!row) return null;

	const reports = await db
		.select({ id: members.id, name: members.name, status: members.status })
		.from(members)
		.where(eq(members.leaderId, memberId))
		.orderBy(asc(members.name));

	return { ...row, reports };
}

export type MemberDetail = NonNullable<
	Awaited<ReturnType<typeof selectMemberDetail>>
>;
