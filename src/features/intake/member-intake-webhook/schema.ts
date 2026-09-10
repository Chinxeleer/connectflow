import { z } from "zod";
import {
	AREA_GROUP_LABELS,
	type AreaGroup,
	areaGroup,
	YEAR_OF_STUDY_LABELS,
	type YearOfStudy,
	yearOfStudy,
} from "@/db/schema/members.ts";

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
 * the payload carries whatever text the option displays ("Main (Central)"),
 * not the slug we store ("main_central") — so this accepts either, matching
 * the label case-insensitively since form authors won't always match it
 * exactly.
 */
function resolveEnumChoice<T extends string>(
	enumValues: readonly T[],
	labels: Record<T, string>,
	raw: string,
): T | null {
	const trimmed = raw.trim();
	if ((enumValues as readonly string[]).includes(trimmed)) {
		return trimmed as T;
	}

	const normalized = trimmed.toLowerCase();
	return (
		enumValues.find((value) => labels[value].toLowerCase() === normalized) ??
		null
	);
}

/** A choice field that's allowed to be blank/unanswered. */
function optionalEnumChoice<T extends string>(
	enumValues: readonly T[],
	labels: Record<T, string>,
	fieldName: string,
) {
	return z
		.string()
		.nullish()
		.transform((value, ctx) => {
			const raw = (value ?? "").trim();
			if (raw === "") return null;

			const resolved = resolveEnumChoice(enumValues, labels, raw);
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
) {
	return z
		.string()
		.nullish()
		.transform((value, ctx) => {
			const raw = (value ?? "").trim();
			const resolved =
				raw === "" ? null : resolveEnumChoice(enumValues, labels, raw);
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
 * The Google Form's "new member" response, as the Apps Script trigger POSTs
 * it. `areaGroup` is required — unlike the manual add form, this is the one
 * intake path that always has an answer for it, since the form asks for it
 * directly. `yearOfStudy` follows `fieldOfStudy`'s convention instead: optional,
 * blank is a valid answer, and a blank submission never overwrites an existing
 * one — see `backfill.ts`.
 */
export const memberIntakeWebhookSchema = z.object({
	fullName: z
		.string()
		.trim()
		.min(2, "fullName is required.")
		.max(200, "That name is unreasonably long."),
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
	),
	areaGroup: requiredEnumChoice(
		areaGroup.enumValues,
		AREA_GROUP_LABELS,
		"areaGroup",
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
		fullName: data.fullName,
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
