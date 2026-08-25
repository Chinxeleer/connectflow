import { z } from "zod";
import { memberStatus } from "@/db/schema/members.ts";

const optionalText = z
	.string()
	.trim()
	.max(200, "That is longer than 200 characters.");

/**
 * What the form validates: every optional field is a plain string, so the
 * schema's input type lines up with the form's string defaults.
 *
 * Only the name is required. Everything else is backfilled later — the same
 * assumption the CSV import makes, and why the table shows a quiet
 * "Incomplete" badge rather than treating blanks as an error.
 *
 * `leaderId` is a *request*, not a decision: the server overrides it for a
 * leader so they can only add to their own connect. See `guard.ts`.
 */
export const createMemberInputSchema = z.object({
	name: z
		.string()
		.trim()
		.min(2, "Enter the member's full name.")
		.max(200, "That name is unreasonably long."),
	leaderId: z.uuid("Pick a connect leader from the list.").nullable(),
	phone: optionalText,
	email: optionalText.refine(
		(value) => value === "" || z.email().safeParse(value).success,
		"Enter a valid email address or leave it blank.",
	),
	gender: optionalText,
	residence: optionalText,
	fieldOfStudy: optionalText,
	status: z.enum(memberStatus.enumValues),
});

export type CreateMemberInput = z.input<typeof createMemberInputSchema>;

const blankToNull = (value: string) => (value.length > 0 ? value : null);

/**
 * What the server stores. Same validation, plus blank cells become null rather
 * than empty strings — "" and "not filled in yet" must not be different states
 * in the database, or the Incomplete badge stops meaning anything.
 */
export const createMemberSchema = createMemberInputSchema.transform((data) => ({
	...data,
	phone: blankToNull(data.phone),
	email: blankToNull(data.email),
	gender: blankToNull(data.gender),
	residence: blankToNull(data.residence),
	fieldOfStudy: blankToNull(data.fieldOfStudy),
}));

export type CreateMemberValues = z.output<typeof createMemberSchema>;
