import { db } from "@/db/index.ts";
import type { AreaGroup, MemberStatus } from "@/db/schema/members.ts";
import { members } from "@/db/schema/members.ts";

export type InsertMemberValues = {
	name: string;
	leaderId: string | null;
	phone: string | null;
	email: string | null;
	gender: string | null;
	residence: string | null;
	fieldOfStudy: string | null;
	areaGroup: AreaGroup | null;
	status: MemberStatus;
};

/**
 * The one place a new member row is inserted — the manual add form and the
 * Google Forms intake webhook both call this, so validation-adjacent
 * behaviour (whatever it grows into) stays identical for a member added by
 * hand and one added by the form.
 */
export async function insertMember(values: InsertMemberValues) {
	const [created] = await db
		.insert(members)
		.values(values)
		.returning({ id: members.id, name: members.name });

	if (!created) throw new Error("Failed to create that member.");
	return created;
}
