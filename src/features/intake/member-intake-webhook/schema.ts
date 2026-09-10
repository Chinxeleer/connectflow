import { z } from "zod";
import { areaGroup } from "@/db/schema/members.ts";

const optionalText = z
	.string()
	.trim()
	.max(200, "That is longer than 200 characters.");

/**
 * The Google Form's "new member" response, as the Apps Script trigger POSTs
 * it. `areaGroup` is required — unlike the manual add form, this is the one
 * intake path that always has an answer for it, since the form asks for it
 * directly.
 */
export const memberIntakeWebhookSchema = z.object({
	fullName: z
		.string()
		.trim()
		.min(2, "fullName is required.")
		.max(200, "That name is unreasonably long."),
	phone: optionalText.default(""),
	email: optionalText
		.default("")
		.refine(
			(value) => value === "" || z.email().safeParse(value).success,
			"email must be a valid address or blank.",
		),
	gender: optionalText.default(""),
	residence: optionalText.default(""),
	fieldOfStudy: optionalText.default(""),
	areaGroup: z.enum(
		areaGroup.enumValues,
		"areaGroup must be one of the five area groups.",
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
 * two different states in the database.
 */
export const memberIntakeSchema = memberIntakeWebhookSchema.transform(
	(data) => ({
		fullName: data.fullName,
		phone: blankToNull(data.phone),
		email: blankToNull(data.email),
		gender: blankToNull(data.gender),
		residence: blankToNull(data.residence),
		fieldOfStudy: blankToNull(data.fieldOfStudy),
		areaGroup: data.areaGroup,
		submittedAt: new Date(data.submittedAt),
	}),
);

export type MemberIntakeValues = z.output<typeof memberIntakeSchema>;
