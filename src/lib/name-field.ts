import { z } from "zod";

/**
 * `min(1)` after `.trim()` isn't enough to guarantee a real name — it still
 * accepts punctuation-only ("-", "N/A"), digits-only, or a character `.trim()`
 * doesn't strip (e.g. a zero-width space), any of which reads as blank to a
 * human but "valid" to the schema. Requiring at least one actual letter
 * catches all of those at the webhook door, before a nameless submission can
 * ever reach `matchPerson` and land in Needs Review as an unreadable entry.
 * `\p{L}` matches a letter in any script, not just ASCII.
 */
const HAS_LETTER = /\p{L}/u;

export function requiredNameField(fieldName: string) {
	return z
		.string()
		.trim()
		.min(1, `${fieldName} is required.`)
		.max(200, "That name is unreasonably long.")
		.refine(
			(value) => HAS_LETTER.test(value),
			`${fieldName} must contain at least one letter.`,
		);
}
