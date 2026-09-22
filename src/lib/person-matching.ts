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
 * more typos. This is the default `namesAreClose` threshold, and the only
 * one `matchPersonForRemoval` ever uses.
 */
export const NAME_SIMILARITY_THRESHOLD = 0.82;

/**
 * The bar `matchPerson`'s name-only tier (no email, no phone) uses to decide
 * a submission confidently updates the one person it resembles, instead of
 * going to a human. Deliberately lower than `NAME_SIMILARITY_THRESHOLD` —
 * that constant governs "close enough to flag as a candidate at all" (still
 * used, at this same lower bar, by every tier inside `matchPerson`); this one
 * governs "close enough to act on unsupervised" when name is *all* there is.
 * Only ever applies when exactly one existing person clears it — two or more
 * candidates above this threshold is exactly the ambiguity a human needs to
 * resolve, so that still routes to `NEEDS_REVIEW`.
 */
export const NAME_AUTO_APPLY_THRESHOLD = 0.7;

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
 *
 * `threshold` defaults to `NAME_SIMILARITY_THRESHOLD` — pass
 * `NAME_AUTO_APPLY_THRESHOLD` (or any other bar) explicitly where a caller
 * needs a different tolerance.
 */
export function namesAreClose(
	a: string,
	b: string,
	threshold: number = NAME_SIMILARITY_THRESHOLD,
): boolean {
	const normalizedA = normalizeName(a);
	const normalizedB = normalizeName(b);

	if (normalizedA === normalizedB) return true;
	if (normalizedA === "" || normalizedB === "") return false;

	const longer = Math.max(normalizedA.length, normalizedB.length);
	const similarity = 1 - levenshteinDistance(normalizedA, normalizedB) / longer;
	return similarity >= threshold;
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
 * parts, independently, at `NAME_AUTO_APPLY_THRESHOLD`. A close first name
 * with a wildly different surname (or vice versa) is not a name match at
 * all; two people can easily share one without being the same person.
 */
function nameIsCloseTo(
	candidate: MatchCandidatePerson,
	payload: Pick<IntakeMatchPayload, "firstName" | "surname">,
): boolean {
	const stored = splitStoredName(candidate.name);
	return (
		namesAreClose(
			stored.firstName,
			payload.firstName,
			NAME_AUTO_APPLY_THRESHOLD,
		) &&
		namesAreClose(stored.surname, payload.surname, NAME_AUTO_APPLY_THRESHOLD)
	);
}

/**
 * Classifies one intake submission against everyone already on file.
 *
 * Email or phone matching a single person, with a name that doesn't
 * contradict it, is always confident. With no email or phone at all, a name
 * match still auto-applies — but only when it resembles exactly one existing
 * person; resembling two or more is exactly the ambiguity that needs a human,
 * so that still routes to `NEEDS_REVIEW`.
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

	if (nameMatches.length === 1) {
		// biome-ignore lint/style/noNonNullAssertion: length === 1 by the check above
		return { outcome: "CONFIDENT_UPDATE", personId: nameMatches[0]!.id };
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

/**
 * Resolves "who did the submitter say their connect leader is" against
 * everyone on file — free text, not a fixed choice, so there's no schema-level
 * validation to lean on. Auto-applies at `NAME_AUTO_APPLY_THRESHOLD` (the
 * same bar `matchPerson`'s name-only tier uses), but only when it resolves to
 * exactly one person; two or more, or nobody at all, means "don't guess" —
 * the member is created without a leader and picked up later the same way
 * any other unassigned member is, through Staging.
 *
 * Splits the submitted text the same way a stored name is split
 * (`splitStoredName`) — a leader named as a single word (no discernible
 * surname) can never confidently match anyone, which is the right call: a
 * bare first name is nowhere near enough to safely pick one person out of a
 * membership this size.
 */
export function matchLeaderByName(
	rawName: string,
	existingPeople: ReadonlyArray<NameOnlyCandidate>,
): string | null {
	const target = splitStoredName(rawName);
	if (!target.firstName || !target.surname) return null;

	const matches = existingPeople.filter((p) => {
		const stored = splitStoredName(p.name);
		return (
			namesAreClose(
				stored.firstName,
				target.firstName,
				NAME_AUTO_APPLY_THRESHOLD,
			) &&
			namesAreClose(stored.surname, target.surname, NAME_AUTO_APPLY_THRESHOLD)
		);
	});

	// biome-ignore lint/style/noNonNullAssertion: length === 1 by the check above
	return matches.length === 1 ? matches[0]!.id : null;
}
