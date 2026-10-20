import type { AreaGroup, Ministry, YearOfStudy } from "@/db/schema/members.ts";
import type { MemberIntakeValues } from "./schema.ts";

export type ExistingMemberFields = {
	email: string | null;
	phone: string | null;
	gender: string | null;
	residence: string | null;
	fieldOfStudy: string | null;
	areaGroup: AreaGroup | null;
	yearOfStudy: YearOfStudy | null;
	ministry: Ministry | null;
	leaderId: string | null;
};

export type IntakeBackfillPatch = Partial<{
	email: string;
	phone: string;
	gender: string;
	residence: string;
	fieldOfStudy: string;
	areaGroup: AreaGroup;
	yearOfStudy: YearOfStudy;
	ministry: Ministry;
	leaderId: string;
}>;

/**
 * What a repeat form submission should change on a member it matched — any
 * field where the new answer differs from what's on file, not just the ones
 * that were still blank. This is deliberately a real update, not just a
 * backfill: someone with no login still needs a way to correct their own
 * details (a new phone number, a residence change, finishing a field they
 * left blank the first time), and resubmitting the form is that way. A
 * blank incoming answer is never applied — the form has no "clear this
 * field" affordance, so a blank means "didn't answer this time", not
 * "delete the old value". `name` isn't part of this at all; it's required
 * on the row and also what the next submission's own fuzzy match leans on,
 * so letting it drift on every resubmission risks a person failing to match
 * their own prior record.
 *
 * `leaderId` is the one field that stays backfill-only even though
 * everything else now overwrites on a difference: reassigning who leads
 * someone is an admin-only action everywhere else in the app
 * (`update-member-profile`'s guard), and this webhook has no session to
 * check that against. A resubmission can fill in a leader that's missing,
 * never silently swap one that's already set — a prospective member typing
 * a different name here could otherwise detach someone from their real
 * leader with no admin in the loop at all.
 *
 * `resolvedLeaderId` is not part of `incoming` for the same reason as
 * always — unlike every other field, it isn't parsed straight from the
 * payload, it comes from matching the submitted "connect leader" text
 * against everyone on file (see `matchLeaderByName`), including the
 * self-reference and cycle checks only the caller can do with a database in
 * hand.
 */
export function buildIntakeBackfillPatch(
	existing: ExistingMemberFields,
	incoming: MemberIntakeValues,
	resolvedLeaderId: string | null,
): IntakeBackfillPatch {
	const patch: IntakeBackfillPatch = {};

	if (incoming.email !== null && incoming.email !== existing.email) {
		patch.email = incoming.email;
	}
	if (incoming.phone !== null && incoming.phone !== existing.phone) {
		patch.phone = incoming.phone;
	}
	if (incoming.gender !== null && incoming.gender !== existing.gender) {
		patch.gender = incoming.gender;
	}
	if (
		incoming.residence !== null &&
		incoming.residence !== existing.residence
	) {
		patch.residence = incoming.residence;
	}
	if (
		incoming.fieldOfStudy !== null &&
		incoming.fieldOfStudy !== existing.fieldOfStudy
	) {
		patch.fieldOfStudy = incoming.fieldOfStudy;
	}
	if (
		incoming.yearOfStudy !== null &&
		incoming.yearOfStudy !== existing.yearOfStudy
	) {
		patch.yearOfStudy = incoming.yearOfStudy;
	}
	if (incoming.ministry !== null && incoming.ministry !== existing.ministry) {
		patch.ministry = incoming.ministry;
	}
	// areaGroup is required on the incoming payload — never null — so the only
	// question is whether it differs from what's on file.
	if (incoming.areaGroup !== existing.areaGroup) {
		patch.areaGroup = incoming.areaGroup;
	}
	if (existing.leaderId === null && resolvedLeaderId !== null) {
		patch.leaderId = resolvedLeaderId;
	}

	return patch;
}
