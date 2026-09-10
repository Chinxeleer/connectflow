import type { AreaGroup, YearOfStudy } from "@/db/schema/members.ts";
import type { MemberIntakeValues } from "./schema.ts";

export type ExistingMemberFields = {
	email: string | null;
	phone: string | null;
	gender: string | null;
	residence: string | null;
	fieldOfStudy: string | null;
	areaGroup: AreaGroup | null;
	yearOfStudy: YearOfStudy | null;
};

export type IntakeBackfillPatch = Partial<{
	email: string;
	phone: string;
	gender: string;
	residence: string;
	fieldOfStudy: string;
	areaGroup: AreaGroup;
	yearOfStudy: YearOfStudy;
}>;

/**
 * What a repeat form submission should change on a member it matched:
 * only the fields the member row doesn't have an answer for yet. A second
 * submission — a correction, a resend, the member filling in more of the
 * form the second time round — must never clobber data that's already
 * there, including with blanks; `name` isn't part of this at all, since it's
 * required on the row and therefore never "missing".
 *
 * `email` is included here now that a member can be matched by name alone
 * (see `match.ts`) — a name match only ever happens against a member with no
 * email on file, so this is how that member's first real email gets
 * recorded, and how they become eligible for the faster, safer email match
 * on their next submission.
 */
export function buildIntakeBackfillPatch(
	existing: ExistingMemberFields,
	incoming: MemberIntakeValues,
): IntakeBackfillPatch {
	const patch: IntakeBackfillPatch = {};

	if (existing.email === null && incoming.email !== null) {
		patch.email = incoming.email;
	}
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
	if (existing.yearOfStudy === null && incoming.yearOfStudy !== null) {
		patch.yearOfStudy = incoming.yearOfStudy;
	}
	// areaGroup is required on the incoming payload — never null — so the only
	// question is whether the existing row already has one.
	if (existing.areaGroup === null) {
		patch.areaGroup = incoming.areaGroup;
	}

	return patch;
}
