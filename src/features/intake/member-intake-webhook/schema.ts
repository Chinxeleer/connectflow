import { z } from "zod";
import {
	AREA_GROUP_LABELS,
	type AreaGroup,
	areaGroup,
	MINISTRY_LABELS,
	type Ministry,
	ministry,
	YEAR_OF_STUDY_LABELS,
	type YearOfStudy,
	yearOfStudy,
} from "@/db/schema/members.ts";
import { requiredNameField } from "@/lib/name-field.ts";

/**
 * The Apps Script trigger sends `null` for an unanswered question, not a
 * missing key — `JSON.stringify` keeps `null` but drops `undefined` — so
 * every optional field has to tolerate both, not just an absent key. `.default()`
 * alone only rescues `undefined`.
 */
const optionalText = z
	.string()
	.trim()
	.max(200, "That is longer than 200 characters.")
	.nullish()
	.transform((value) => value ?? "");

/**
 * Resolves a choice question's answer to the enum value it's stored as.
 * Google Forms has no separate value/label for a multiple-choice question —
 * the payload carries whatever text the option displays, not the slug we
 * store — so this accepts either, matching the label case-insensitively
 * since form authors won't always match it exactly. `aliases` covers the
 * remaining gap: real option text that doesn't resemble the stored label at
 * all (different word order, abbreviated, reworded) — confirmed against the
 * actual live form rather than guessed.
 */
function resolveEnumChoice<T extends string>(
	enumValues: readonly T[],
	labels: Record<T, string>,
	raw: string,
	aliases: Record<string, T> = {},
): T | null {
	const trimmed = raw.trim();
	if ((enumValues as readonly string[]).includes(trimmed)) {
		return trimmed as T;
	}

	const normalized = trimmed.toLowerCase();
	const labelMatch = enumValues.find(
		(value) => labels[value].toLowerCase() === normalized,
	);
	if (labelMatch) return labelMatch;

	return aliases[normalized] ?? null;
}

/** A choice field that's allowed to be blank/unanswered. */
function optionalEnumChoice<T extends string>(
	enumValues: readonly T[],
	labels: Record<T, string>,
	fieldName: string,
	aliases?: Record<string, T>,
	/**
	 * Option text that means "no answer", same as blank — e.g. ministry's
	 * "Not yet allocated" option. Lowercased to match how `resolveEnumChoice`
	 * normalises before checking `aliases`.
	 */
	nullOptions: readonly string[] = [],
) {
	return z
		.string()
		.nullish()
		.transform((value, ctx) => {
			const raw = (value ?? "").trim();
			if (raw === "") return null;
			if (nullOptions.includes(raw.toLowerCase())) return null;

			const resolved = resolveEnumChoice(enumValues, labels, raw, aliases);
			if (!resolved) {
				ctx.addIssue({
					code: "custom",
					message: `${fieldName} must be one of the fixed values or blank.`,
				});
				return z.NEVER;
			}
			return resolved;
		});
}

/** A choice field that must have an answer. */
function requiredEnumChoice<T extends string>(
	enumValues: readonly T[],
	labels: Record<T, string>,
	fieldName: string,
	aliases?: Record<string, T>,
) {
	return z
		.string()
		.nullish()
		.transform((value, ctx) => {
			const raw = (value ?? "").trim();
			const resolved =
				raw === "" ? null : resolveEnumChoice(enumValues, labels, raw, aliases);
			if (!resolved) {
				ctx.addIssue({
					code: "custom",
					message: `${fieldName} must be one of the fixed values.`,
				});
				return z.NEVER;
			}
			return resolved;
		});
}

/**
 * The area group question's live options don't all match `AREA_GROUP_LABELS`
 * verbatim — confirmed directly against the form. Keyed lowercase to match
 * how `resolveEnumChoice` normalises before checking aliases.
 */
const AREA_GROUP_ALIASES: Record<string, AreaGroup> = {
	"central(main)": "main_central",
};

/**
 * The year of study question's live options, confirmed directly against the
 * form. It's been reworded at least twice: bare digits ("3") originally, then
 * ordinals ("3rd") — both kept here since a submission already in flight
 * when the form changes still needs to resolve. "PostGrad", "Alumni" and
 * "Ministry" already match their labels case-insensitively, so they need no
 * entry here at all.
 */
const YEAR_OF_STUDY_ALIASES: Record<string, YearOfStudy> = {
	"1": "year_1",
	"2": "year_2",
	"3": "year_3",
	"4": "year_4",
	"5": "year_5",
	"6": "year_6",
	"1st": "year_1",
	"2nd": "year_2",
	"3rd": "year_3",
	"4th": "year_4",
	"5th": "year_5",
	"6th": "year_6",
};

/**
 * The Google Form's "new member" response, as the Apps Script trigger POSTs
 * it. Separate `firstName`/`surname` rather than one combined name — matching
 * the removal webhook's existing shape, and required because `matchPerson`
 * (see `@/lib/person-matching.ts`) compares the two independently: a close
 * first name paired with an unrelated surname is not a name match at all.
 *
 * `areaGroup` is required — unlike the manual add form, this is the one
 * intake path that always has an answer for it, since the form asks for it
 * directly. `yearOfStudy` and `ministry` follow `fieldOfStudy`'s convention
 * instead: optional, blank is a valid answer, and a blank submission never
 * overwrites an existing one — see `backfill.ts`. `ministry` stays optional
 * here even though the live form question is itself required — a form
 * question can be made optional, reworded, or dropped without this schema
 * needing to change in lockstep, and rejecting an otherwise-good submission
 * over one missing field would be a worse outcome than storing it as null.
 */
export const memberIntakeWebhookSchema = z.object({
	firstName: requiredNameField("firstName"),
	surname: requiredNameField("surname"),
	phone: optionalText,
	email: optionalText.refine(
		(value) => value === "" || z.email().safeParse(value).success,
		"email must be a valid address or blank.",
	),
	gender: optionalText,
	residence: optionalText,
	fieldOfStudy: optionalText,
	yearOfStudy: optionalEnumChoice(
		yearOfStudy.enumValues,
		YEAR_OF_STUDY_LABELS,
		"yearOfStudy",
		YEAR_OF_STUDY_ALIASES,
	),
	// The live form's fifth option, "Not yet allocated", is a real answer
	// meaning "no ministry yet" — not an unrecognised one — confirmed
	// directly against the form.
	ministry: optionalEnumChoice(
		ministry.enumValues,
		MINISTRY_LABELS,
		"ministry",
		undefined,
		["not yet allocated"],
	),
	areaGroup: requiredEnumChoice(
		areaGroup.enumValues,
		AREA_GROUP_LABELS,
		"areaGroup",
		AREA_GROUP_ALIASES,
	),
	/**
	 * Free text naming who the submitter says their connect leader is — not
	 * an enum choice like the others, since it's whoever the member typed, not
	 * a fixed list. Resolved against existing members by name in `query.ts`;
	 * blank means "don't know" and is never treated as a failed match.
	 */
	connectLeader: optionalText,
	submittedAt: z.iso.datetime({ offset: true }),
});

export type MemberIntakeWebhookInput = z.infer<
	typeof memberIntakeWebhookSchema
>;

const blankToNull = (value: string) => (value.length > 0 ? value : null);

/**
 * What actually gets stored — blank cells become null, same rule the manual
 * add form and the CSV import both follow, so "" and "not answered" are never
 * two different states in the database. `yearOfStudy` and `areaGroup` are
 * already resolved to their stored enum values by this point.
 */
export const memberIntakeSchema = memberIntakeWebhookSchema.transform(
	(data) => ({
		firstName: data.firstName,
		surname: data.surname,
		phone: blankToNull(data.phone),
		email: blankToNull(data.email),
		gender: blankToNull(data.gender),
		residence: blankToNull(data.residence),
		fieldOfStudy: blankToNull(data.fieldOfStudy),
		yearOfStudy: data.yearOfStudy as YearOfStudy | null,
		ministry: data.ministry as Ministry | null,
		areaGroup: data.areaGroup as AreaGroup,
		connectLeaderName: blankToNull(data.connectLeader),
		submittedAt: new Date(data.submittedAt),
	}),
);

export type MemberIntakeValues = z.output<typeof memberIntakeSchema>;
