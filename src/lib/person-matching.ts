/**
 * Tiered, fuzzy-aware matching for a submission naming one person against
 * everyone already on file. Used by both the member-intake and
 * member-removal webhooks — the question ("is this the same person") is the
 * same either way, just with different consequences for getting it wrong
 * (intake updates/creates a record; removal soft-deletes one), so each
 * caller decides its own tolerance for auto-deciding on top of the same
 * primitives.
 */

/**
 * Collapses a name to a comparable form: trimmed, lowercased, punctuation
 * stripped, internal whitespace runs collapsed to one space. Exported so
 * tests can assert on it directly.
 */
export function normalizeName(value: string): string {
	return value
		.trim()
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s]/gu, "")
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * The stored people table has no first/last split — `members.name` is one
 * field — so comparing it against a submission's separate first name and
 * surname means splitting it first. Convention: the last word is the
 * surname, everything before it is the first name. Imperfect for anyone
 * with a multi-word surname, but consistent everywhere it's used.
 */
export function splitStoredName(name: string): {
	firstName: string;
	surname: string;
} {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length <= 1) {
		return { firstName: parts[0] ?? "", surname: "" };
	}
	return {
		firstName: parts.slice(0, -1).join(" "),
		// biome-ignore lint/style/noNonNullAssertion: parts.length > 1 by the check above
		surname: parts.at(-1)!,
	};
}

/**
 * How close two normalized names need to be (as a fraction of the longer
 * one's length) to count as "probably the same, probably a typo" rather
 * than "probably different people". One tunable constant, not scattered
 * magic numbers — raise it to demand closer matches, lower it to tolerate
 * more typos.
 */
export const NAME_SIMILARITY_THRESHOLD = 0.82;

/**
 * Reads/writes one cell of the DP grid below. `i`/`j` are always within
 * `[0, rows) x [0, cols)` by construction in `levenshteinDistance`, so this
 * centralises the one non-null assertion that's actually needed instead of
 * repeating it at every access.
 */
function cell(grid: number[][], i: number, j: number): number {
	// biome-ignore lint/style/noNonNullAssertion: i and j are always in bounds by construction
	return grid[i]![j]!;
}

/** Classic edit-distance DP. O(a.length * b.length), fine at name lengths. */
function levenshteinDistance(a: string, b: string): number {
	const rows = a.length + 1;
	const cols = b.length + 1;
	const distances: number[][] = Array.from({ length: rows }, () =>
		new Array<number>(cols).fill(0),
	);

	for (let i = 0; i < rows; i++) distances[i][0] = i;
	for (let j = 0; j < cols; j++) distances[0][j] = j;

	for (let i = 1; i < rows; i++) {
		for (let j = 1; j < cols; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			distances[i][j] = Math.min(
				cell(distances, i - 1, j) + 1,
				cell(distances, i, j - 1) + 1,
				cell(distances, i - 1, j - 1) + cost,
			);
		}
	}

	return cell(distances, rows - 1, cols - 1);
}

/**
 * Whether two names are close enough to be the same person, allowing for
 * typos. Case- and whitespace-only differences always count (normalized
 * forms are compared for exact equality first) — that is not a typo, it is
 * the same string. Below that, similarity is edit distance normalized by
 * the longer name's length, so the tolerance scales with name length rather
 * than being a fixed number of characters.
 */
export function namesAreClose(a: string, b: string): boolean {
	const normalizedA = normalizeName(a);
	const normalizedB = normalizeName(b);

	if (normalizedA === normalizedB) return true;
	if (normalizedA === "" || normalizedB === "") return false;

	const longer = Math.max(normalizedA.length, normalizedB.length);
	const similarity = 1 - levenshteinDistance(normalizedA, normalizedB) / longer;
	return similarity >= NAME_SIMILARITY_THRESHOLD;
}

export type MatchCandidatePerson = {
	id: string;
	name: string;
	email: string | null;
	phone: string | null;
};

export type IntakeMatchPayload = {
	firstName: string;
	surname: string;
	email: string | null;
	phone: string | null;
};

export type MatchCandidate = { personId: string; matchReason: string };

export type MatchResult =
	| { outcome: "CONFIDENT_UPDATE"; personId: string }
	| { outcome: "CONFIDENT_CREATE" }
	| { outcome: "NEEDS_REVIEW"; candidates: MatchCandidate[] };

function normalizedEmail(value: string | null): string | null {
	const trimmed = value?.trim().toLowerCase();
	return trimmed ? trimmed : null;
}

function normalizedPhone(value: string | null): string | null {
	const trimmed = value?.trim();
	return trimmed ? trimmed : null;
}

/**
 * Whether a candidate's stored name is close to the submitted name — both
 * parts, independently. A close first name with a wildly different surname
 * (or vice versa) is not a name match at all; two people can easily share
 * one without being the same person.
 */
function nameIsCloseTo(
	candidate: MatchCandidatePerson,
	payload: Pick<IntakeMatchPayload, "firstName" | "surname">,
): boolean {
	const stored = splitStoredName(candidate.name);
	return (
		namesAreClose(stored.firstName, payload.firstName) &&
		namesAreClose(stored.surname, payload.surname)
	);
}

/**
 * Classifies one intake submission against everyone already on file.
 *
 * A name match — however close, even an exact one — never produces
 * CONFIDENT_UPDATE on its own. Names repeat across unrelated people in a
 * group this size; only email or phone are precise enough identifiers to
 * auto-decide on, and even then only when the name doesn't actively
 * contradict them.
 */
export function matchPerson(
	payload: IntakeMatchPayload,
	existingPeople: ReadonlyArray<MatchCandidatePerson>,
): MatchResult {
	const email = normalizedEmail(payload.email);
	const phone = normalizedPhone(payload.phone);

	const emailMatches = email
		? existingPeople.filter((p) => normalizedEmail(p.email) === email)
		: [];
	const phoneMatches = phone
		? existingPeople.filter((p) => normalizedPhone(p.phone) === phone)
		: [];

	if (emailMatches.length > 1) {
		return {
			outcome: "NEEDS_REVIEW",
			candidates: emailMatches.map((p) => ({
				personId: p.id,
				matchReason: "email matches more than one person on file",
			})),
		};
	}

	if (emailMatches.length === 1) {
		// biome-ignore lint/style/noNonNullAssertion: length === 1 by the check above
		const person = emailMatches[0]!;

		const [phoneMatch] = phoneMatches;
		if (
			phoneMatches.length === 1 &&
			phoneMatch &&
			phoneMatch.id !== person.id
		) {
			return {
				outcome: "NEEDS_REVIEW",
				candidates: [
					{ personId: person.id, matchReason: "matched by email" },
					{
						personId: phoneMatch.id,
						matchReason:
							"matched by phone, but a different person than the email match",
					},
				],
			};
		}

		if (nameIsCloseTo(person, payload)) {
			return { outcome: "CONFIDENT_UPDATE", personId: person.id };
		}

		return {
			outcome: "NEEDS_REVIEW",
			candidates: [
				{
					personId: person.id,
					matchReason: "email matches but name differs substantially",
				},
			],
		};
	}

	// No email match at all — try phone.
	if (phoneMatches.length > 1) {
		return {
			outcome: "NEEDS_REVIEW",
			candidates: phoneMatches.map((p) => ({
				personId: p.id,
				matchReason: "phone matches more than one person on file",
			})),
		};
	}

	if (phoneMatches.length === 1) {
		// biome-ignore lint/style/noNonNullAssertion: length === 1 by the check above
		const person = phoneMatches[0]!;

		if (nameIsCloseTo(person, payload)) {
			return { outcome: "CONFIDENT_UPDATE", personId: person.id };
		}

		return {
			outcome: "NEEDS_REVIEW",
			candidates: [
				{
					personId: person.id,
					matchReason: "phone matches someone whose name doesn't match",
				},
			],
		};
	}

	// No email, no phone. Only a name to go on.
	const nameMatches = existingPeople.filter((p) => nameIsCloseTo(p, payload));

	if (nameMatches.length === 0) {
		return { outcome: "CONFIDENT_CREATE" };
	}

	return {
		outcome: "NEEDS_REVIEW",
		candidates: nameMatches.map((p) => ({
			personId: p.id,
			matchReason:
				"name is a close match, with no corroborating email or phone",
		})),
	};
}

export type NameOnlyCandidate = { id: string; name: string };

export type NameMatchResult =
	| { outcome: "EXACT_MATCH"; personId: string }
	| { outcome: "NEEDS_REVIEW"; candidates: MatchCandidate[] };

/**
 * Classifies a removal request — name only, no email or phone to
 * corroborate against — for everyone on file. An exact (post-normalize)
 * match to exactly one person auto-executes, the same rule this replaces
 * already proved correct. Everything else routes to a human: several exact
 * matches, a fuzzy-but-not-exact match (one or more), or nothing at all.
 * Soft-deleting the wrong person is worse than an intake record briefly
 * duplicated, so this stays stricter than `matchPerson` — a fuzzy name match
 * here is never enough on its own, even with just one candidate.
 *
 * The exact tier compares the whole reconstructed name as one string, not
 * `firstName`/`surname` split independently — a stored name's own
 * first/last boundary (see `splitStoredName`) can legitimately land
 * differently than the submitted one for a multi-word name, and the exact
 * tier must not regress on names it already matched correctly.
 */
export function matchPersonForRemoval(
	payload: { firstName: string; surname: string },
	existingPeople: ReadonlyArray<NameOnlyCandidate>,
): NameMatchResult {
	const target = normalizeName(`${payload.firstName} ${payload.surname}`);
	const exactMatches = existingPeople.filter(
		(p) => normalizeName(p.name) === target,
	);

	if (exactMatches.length === 1) {
		// biome-ignore lint/style/noNonNullAssertion: length === 1 by the check above
		return { outcome: "EXACT_MATCH", personId: exactMatches[0]!.id };
	}

	if (exactMatches.length > 1) {
		return {
			outcome: "NEEDS_REVIEW",
			candidates: exactMatches.map((p) => ({
				personId: p.id,
				matchReason: "name matches more than one person on file",
			})),
		};
	}

	const fuzzyMatches = existingPeople.filter((p) => {
		const stored = splitStoredName(p.name);
		return (
			namesAreClose(stored.firstName, payload.firstName) &&
			namesAreClose(stored.surname, payload.surname)
		);
	});

	return {
		outcome: "NEEDS_REVIEW",
		candidates: fuzzyMatches.map((p) => ({
			personId: p.id,
			matchReason: "name is a close match, but not exact",
		})),
	};
}
