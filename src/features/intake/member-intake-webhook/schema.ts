import { z } from "zod";
import {
	AREA_GROUP_LABELS,
	type AreaGroup,
	areaGroup,
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
) {
	return z
		.string()
		.nullish()
		.transform((value, ctx) => {
			const raw = (value ?? "").trim();
			if (raw === "") return null;

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
 * The year of study question's live options are bare digits ("3"), not the
 * "Year 3" text `YEAR_OF_STUDY_LABELS` has — confirmed directly against a
 * real submission. Only "Postgrad" happens to already match its label
 * verbatim.
 */
const YEAR_OF_STUDY_ALIASES: Record<string, YearOfStudy> = {
	"1": "year_1",
	"2": "year_2",
	"3": "year_3",
	"4": "year_4",
	"5": "year_5",
	"6": "year_6",
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
 * directly. `yearOfStudy` follows `fieldOfStudy`'s convention instead: optional,
 * blank is a valid answer, and a blank submission never overwrites an existing
 * one — see `backfill.ts`.
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
	areaGroup: requiredEnumChoice(
		areaGroup.enumValues,
		AREA_GROUP_LABELS,
		"areaGroup",
		AREA_GROUP_ALIASES,
	),
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
		areaGroup: data.areaGroup as AreaGroup,
		submittedAt: new Date(data.submittedAt),
	}),
);

export type MemberIntakeValues = z.output<typeof memberIntakeSchema>;
