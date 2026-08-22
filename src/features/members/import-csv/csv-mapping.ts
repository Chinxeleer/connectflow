/**
 * Pure CSV shaping for the member import. No database, no session — every
 * function here is deterministic so the import's behaviour can be pinned down
 * in tests before it ever touches a table.
 */

/**
 * Trailing group labels that decorate a leader's name in the source sheet, e.g.
 * "Grace Hopper - Group A", "Grace Hopper (Group 2)", "Grace Hopper – GRP 3".
 * Only a *trailing* label is stripped; a name is never rewritten mid-string.
 */
const GROUP_SUFFIX =
	/[\s]*[-–—([|/]*[\s]*\b(?:group|grp|g|connect|cg)\b[\s]*[-–—:#]?[\s]*[a-z0-9]*[\s]*[)\]]?[\s]*$/i;

/** Collapses runs of whitespace and trims, without touching internal casing. */
export function normaliseWhitespace(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

/**
 * Strips a trailing group label to get the leader's base name.
 *
 * Returns the original (whitespace-normalised) value when stripping would leave
 * nothing — "Group A" on its own is a label, not a person, and the caller
 * decides what to do with it rather than silently getting "".
 */
export function stripGroupSuffix(label: string): string {
	const cleaned = normaliseWhitespace(label);
	const stripped = normaliseWhitespace(cleaned.replace(GROUP_SUFFIX, ""));

	return stripped.length > 0 ? stripped : cleaned;
}

/** Case- and spacing-insensitive key for matching two spellings of a name. */
export function leaderKey(name: string): string {
	return normaliseWhitespace(name).toLowerCase();
}

/**
 * Forward-fills a sparse leader column.
 *
 * Source sheets name the leader once and leave the cell blank for the rest of
 * that leader's people. A blank inherits the last non-blank value above it;
 * blanks before any value stay blank, since there is nothing to inherit and
 * guessing would attach people to the wrong group.
 */
export function forwardFill(column: ReadonlyArray<string | null | undefined>) {
	let carried: string | null = null;

	return column.map((raw) => {
		const value = normaliseWhitespace(raw ?? "");
		if (value.length > 0) carried = value;
		return carried;
	});
}

export type LeaderLabelResolution = {
	/** Distinct base names, in first-seen order. */
	baseNames: string[];
	/** Base name -> every raw label that produced it. */
	labelsByBaseName: Map<string, string[]>;
};

/**
 * Groups raw leader labels by the base name they strip to.
 *
 * Several labels mapping to one base name is the normal case — that is exactly
 * what "Grace Hopper - Group A" and "Grace Hopper - Group B" mean.
 */
export function resolveLeaderLabels(
	labels: ReadonlyArray<string | null>,
): LeaderLabelResolution {
	const labelsByBaseName = new Map<string, string[]>();
	const baseNames: string[] = [];

	for (const label of labels) {
		if (!label) continue;

		const base = stripGroupSuffix(label);
		const key = leaderKey(base);

		if (!labelsByBaseName.has(key)) {
			labelsByBaseName.set(key, []);
			baseNames.push(base);
		}

		const seen = labelsByBaseName.get(key) as string[];
		if (!seen.includes(label)) seen.push(label);
	}

	return { baseNames, labelsByBaseName };
}

export type AmbiguousLeaderLabel = {
	/** The base name that could not be resolved to exactly one member. */
	baseName: string;
	/** The raw labels in the file that produced it. */
	labels: string[];
	/** Names of the candidate members it matched, if any. */
	candidates: string[];
	reason: "no-match" | "multiple-matches";
};

/**
 * Decides which base names cannot be pinned to exactly one member.
 *
 * The import halts on any of these rather than guessing: attaching a group to
 * the wrong leader is silent and hard to notice afterwards, so it is surfaced
 * for a human instead.
 */
export function findAmbiguousLabels(
	resolution: LeaderLabelResolution,
	candidatesByKey: ReadonlyMap<string, string[]>,
): AmbiguousLeaderLabel[] {
	const ambiguous: AmbiguousLeaderLabel[] = [];

	for (const baseName of resolution.baseNames) {
		const key = leaderKey(baseName);
		const candidates = candidatesByKey.get(key) ?? [];
		if (candidates.length === 1) continue;

		ambiguous.push({
			baseName,
			labels: resolution.labelsByBaseName.get(key) ?? [],
			candidates,
			reason: candidates.length === 0 ? "no-match" : "multiple-matches",
		});
	}

	return ambiguous;
}
