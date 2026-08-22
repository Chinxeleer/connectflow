import { z } from "zod";
import { memberStatus } from "@/db/schema/members.ts";

/** Blank cells arrive as "" from the CSV; treat them as absent, not as values. */
const optionalText = z
	.string()
	.trim()
	.transform((value) => (value.length > 0 ? value : null))
	.nullable();

/**
 * One parsed CSV row, after header mapping and forward-fill.
 *
 * `leaderLabel` is the raw sheet value ("Grace Hopper - Group A"), kept intact
 * so an ambiguity can be reported using the words that are actually in the
 * file. Stripping happens in `csv-mapping.ts`.
 */
export const memberImportRowSchema = z.object({
	name: z
		.string()
		.trim()
		.min(2, "Member name is required.")
		.max(200, "Member name is unreasonably long."),
	leaderLabel: optionalText,
	phone: optionalText,
	email: z
		.string()
		.trim()
		.transform((value) => (value.length > 0 ? value : null))
		.nullable()
		.refine(
			(value) => value === null || z.email().safeParse(value).success,
			"Enter a valid email address or leave the cell blank.",
		),
	gender: optionalText,
	residence: optionalText,
	fieldOfStudy: optionalText,
	status: z
		.string()
		.trim()
		.toLowerCase()
		.pipe(z.enum(memberStatus.enumValues))
		.catch("new"),
});

export type MemberImportRow = z.infer<typeof memberImportRowSchema>;

export const memberImportSchema = z
	.array(memberImportRowSchema)
	.min(1, "That file has no member rows.")
	.max(5000, "That file has more than 5000 rows — split it up.");

/** What the server function accepts: the raw file text, parsed server-side. */
export const importCsvSchema = z.object({
	fileName: z.string().trim().min(1),
	csv: z
		.string()
		.min(1, "That file is empty.")
		.max(2_000_000, "That file is larger than 2MB."),
});

export type ImportCsvInput = z.infer<typeof importCsvSchema>;
