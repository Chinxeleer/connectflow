import { z } from "zod";
import { memberStatus } from "@/db/schema/members.ts";

/**
 * Deliberately a copy of the equivalent in `create-member/schema.ts` rather
 * than a shared import: a feature folder maps to one user action, and coupling
 * the add form to the edit form means a change meant for one silently changes
 * the other.
 */
const optionalText = z
	.string()
	.trim()
	.max(200, "That is longer than 200 characters.");

/**
 * What the edit form validates. Every optional field is a plain string so the
 * schema's input type lines up with the form's defaults, which seed `null`
 * columns as `""`.
 *
 * `status` and `leaderId` are present for *every* role, because the form
 * round-trips the current values whether or not the user may change them. The
 * server compares them against the stored row and refuses a change it did not
 * permit — see `guard.ts`. Leaving them out for a leader would make an edited
 * request indistinguishable from an honest one.
 */
export const updateMemberProfileInputSchema = z
	.object({
		memberId: z.uuid("Expected a member id."),
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
	})
	// Cheap to catch here, and it keeps the one-step loop out of the database.
	// The deeper case — a leader moved under their own report — needs the tree
	// and is refused in `action.ts`.
	.refine((data) => data.leaderId !== data.memberId, {
		message: "A member cannot be their own connect leader.",
		path: ["leaderId"],
	});

export type UpdateMemberProfileInput = z.input<
	typeof updateMemberProfileInputSchema
>;

const blankToNull = (value: string) => (value.length > 0 ? value : null);

/**
 * What the server stores. Blank cells become null rather than empty strings —
 * "" and "not filled in yet" must not be different states, or the Incomplete
 * badge on the members table stops meaning anything.
 */
export const updateMemberProfileSchema =
	updateMemberProfileInputSchema.transform((data) => ({
		...data,
		phone: blankToNull(data.phone),
		email: blankToNull(data.email),
		gender: blankToNull(data.gender),
		residence: blankToNull(data.residence),
		fieldOfStudy: blankToNull(data.fieldOfStudy),
	}));

export type UpdateMemberProfileValues = z.output<
	typeof updateMemberProfileSchema
>;
