export type NameCandidate = { id: string; name: string };

/**
 * Collapses a name to a comparable form: trimmed, internal whitespace runs
 * collapsed to one space, lowercased. Exported so the tests can assert on it
 * directly rather than only through `findNameMatches`.
 */
export function normalizeName(value: string): string {
	return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Finds every member whose stored name matches "firstName surname",
 * case- and whitespace-insensitively.
 *
 * The people table has no first/last split — `members.name` is one field —
 * so this reconstructs the full name from the two submitted parts rather than
 * splitting the stored one apart. This is the highest-risk piece of the
 * removal flow: a wrong match here soft-deletes the wrong person, and a
 * missed match silently drops a real removal request, so every branch (exact,
 * case-differing, whitespace-differing, zero matches, multiple matches) is
 * covered in `match.test.ts`.
 */
export function findNameMatches<T extends NameCandidate>(
	candidates: ReadonlyArray<T>,
	firstName: string,
	surname: string,
): T[] {
	const target = normalizeName(`${firstName} ${surname}`);
	return candidates.filter(
		(candidate) => normalizeName(candidate.name) === target,
	);
}
