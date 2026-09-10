import { eq } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { insertMember } from "@/features/members/create-member/index.ts";
import type { MemberIntakeValues } from "./schema.ts";

export type MemberIntakeResult = { id: string; created: boolean };

/**
 * Creates a member from a form submission, or updates one that already
 * exists — matched by an exact, case-sensitive email match, since that's the
 * only field the form and the database are guaranteed to represent the same
 * way. A new member lands with no connect leader (so they surface in the
 * "Without a Connect" bucket, same as any other unassigned member) and
 * status "new", the same landing state a CSV import row gets.
 */
export async function upsertMemberFromIntake(
	values: MemberIntakeValues,
): Promise<MemberIntakeResult> {
	if (values.email) {
		const [existing] = await db
			.select({ id: members.id })
			.from(members)
			.where(eq(members.email, values.email));

		if (existing) {
			await db
				.update(members)
				.set({
					name: values.fullName,
					phone: values.phone,
					gender: values.gender,
					residence: values.residence,
					fieldOfStudy: values.fieldOfStudy,
					areaGroup: values.areaGroup,
				})
				.where(eq(members.id, existing.id));

			return { id: existing.id, created: false };
		}
	}

	const created = await insertMember({
		name: values.fullName,
		leaderId: null,
		phone: values.phone,
		email: values.email,
		gender: values.gender,
		residence: values.residence,
		fieldOfStudy: values.fieldOfStudy,
		areaGroup: values.areaGroup,
		status: "new",
	});

	return { id: created.id, created: true };
}
