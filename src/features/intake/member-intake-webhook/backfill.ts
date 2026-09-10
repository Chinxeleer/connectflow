import type { AreaGroup } from "@/db/schema/members.ts";
import type { MemberIntakeValues } from "./schema.ts";

export type ExistingMemberFields = {
	phone: string | null;
	gender: string | null;
	residence: string | null;
	fieldOfStudy: string | null;
	areaGroup: AreaGroup | null;
};

export type IntakeBackfillPatch = Partial<{
	phone: string;
	gender: string;
	residence: string;
	fieldOfStudy: string;
	areaGroup: AreaGroup;
}>;

/**
 * What a repeat form submission should change on a member matched by email:
 * only the fields the member row doesn't have an answer for yet. A second
 * submission — a correction, a resend, the member filling in more of the
 * form the second time round — must never clobber data that's already
 * there, including with blanks; `name` isn't part of this at all, since it's
 * required on the row and therefore never "missing".
 */
export function buildIntakeBackfillPatch(
	existing: ExistingMemberFields,
	incoming: MemberIntakeValues,
): IntakeBackfillPatch {
	const patch: IntakeBackfillPatch = {};

	if (existing.phone === null && incoming.phone !== null) {
		patch.phone = incoming.phone;
	}
	if (existing.gender === null && incoming.gender !== null) {
		patch.gender = incoming.gender;
	}
	if (existing.residence === null && incoming.residence !== null) {
		patch.residence = incoming.residence;
	}
	if (existing.fieldOfStudy === null && incoming.fieldOfStudy !== null) {
		patch.fieldOfStudy = incoming.fieldOfStudy;
	}
	// areaGroup is required on the incoming payload — never null — so the only
	// question is whether the existing row already has one.
	if (existing.areaGroup === null) {
		patch.areaGroup = incoming.areaGroup;
	}

	return patch;
}
