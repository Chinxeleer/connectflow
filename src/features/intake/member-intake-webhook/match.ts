import { normalizeName } from "../member-removal-webhook/index.ts";

export type NameCandidate = { id: string; name: string };

/**
 * Finds every member whose stored name matches the submitted full name,
 * case- and whitespace-insensitively — the same normalisation the removal
 * webhook uses, reused rather than duplicated since it's the same question
 * ("is this the same name") asked over a different input shape (intake sends
 * one combined name; removal sends first name and surname separately).
 *
 * Callers must restrict `candidates` to members with no email on file before
 * calling this — a name match is only ever safe against an "unclaimed"
 * record. Matching against every member risks silently attaching one
 * person's form answers to a namesake who has already been identified by
 * email.
 */
export function findFullNameMatches<T extends NameCandidate>(
	candidates: ReadonlyArray<T>,
	fullName: string,
): T[] {
	const target = normalizeName(fullName);
	return candidates.filter(
		(candidate) => normalizeName(candidate.name) === target,
	);
}
