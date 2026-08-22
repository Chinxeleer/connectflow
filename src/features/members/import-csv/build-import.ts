import {
	type AmbiguousLeaderLabel,
	findAmbiguousLabels,
	forwardFill,
	leaderKey,
	resolveLeaderLabels,
	stripGroupSuffix,
} from "./csv-mapping.ts";
import { cellAt, mapHeaders, parseCsv } from "./parse-csv.ts";
import { type MemberImportRow, memberImportRowSchema } from "./schema.ts";

export type RowIssue = { row: number; message: string };

export type ParsedImport = {
	rows: MemberImportRow[];
	/** Per-row leader label after forward-fill, aligned with `rows`. */
	leaderLabels: (string | null)[];
	issues: RowIssue[];
};

export class ImportFormatError extends Error {}

/**
 * Turns raw CSV text into validated rows plus a forward-filled leader column.
 *
 * Pure: no database, no session. Everything that decides *what* will be written
 * happens here, so the transaction in `action.ts` stays a thin writer.
 */
export function parseImport(csv: string): ParsedImport {
	const table = parseCsv(csv);

	if (table.length === 0) throw new ImportFormatError("That file is empty.");

	const [headerRow, ...bodyRows] = table;
	const headers = mapHeaders(headerRow ?? []);

	if (headers.name === undefined) {
		// Name the headers that were actually found — without them there is no
		// way to tell a wrong file from an unrecognised column heading.
		const found = (headerRow ?? [])
			.map((cell) => cell.trim())
			.filter(Boolean)
			.map((cell) => `"${cell}"`)
			.join(", ");

		throw new ImportFormatError(
			`No member-name column found. Columns in this file: ${found || "(none)"}. ` +
				'Rename the column holding member names to "Name" (or "Connect Members") and try again.',
		);
	}

	if (bodyRows.length === 0) {
		throw new ImportFormatError("That file has a header but no member rows.");
	}

	// Forward-fill before validating: a blank leader cell is inherited, so it
	// must be resolved while the rows are still in file order.
	const filledLeaders = forwardFill(
		bodyRows.map((row) => cellAt(row, headers.leaderLabel)),
	);

	const rows: MemberImportRow[] = [];
	const leaderLabels: (string | null)[] = [];
	const issues: RowIssue[] = [];

	bodyRows.forEach((row, index) => {
		const parsed = memberImportRowSchema.safeParse({
			name: cellAt(row, headers.name),
			leaderLabel: filledLeaders[index] ?? "",
			phone: cellAt(row, headers.phone),
			email: cellAt(row, headers.email),
			gender: cellAt(row, headers.gender),
			residence: cellAt(row, headers.residence),
			fieldOfStudy: cellAt(row, headers.fieldOfStudy),
			status: cellAt(row, headers.status),
		});

		// +2: one for the header row, one because spreadsheets are 1-indexed.
		const lineNumber = index + 2;

		if (!parsed.success) {
			for (const issue of parsed.error.issues) {
				issues.push({ row: lineNumber, message: issue.message });
			}
			return;
		}

		rows.push(parsed.data);
		leaderLabels.push(parsed.data.leaderLabel);
	});

	return { rows, leaderLabels, issues };
}

export type LeaderCandidate = { id: string; name: string };

export type ImportPlan = {
	/** memberId -> leaderId links to write in the second pass. */
	links: Array<{ memberId: string; leaderId: string }>;
	ambiguous: AmbiguousLeaderLabel[];
};

/**
 * Decides the leader links, or refuses.
 *
 * Any base name that does not resolve to exactly one member halts the whole
 * import — attaching a group to the wrong leader is silent and very hard to
 * notice later, so it goes back to a human instead of being guessed.
 *
 * `candidatesByKey` is keyed by `leaderKey(baseName)` and is built *after* the
 * insert pass, so a leader introduced by this same file can be linked to.
 */
/**
 * Leader names that no member row matches yet.
 *
 * These are not ambiguous — a leader *is* a member, so a name with no row has
 * exactly one reading: that member does not exist yet. The caller creates them
 * and reports what it created. Only a name matching *several* members is a real
 * guess, and that still halts the import.
 */
export function leadersWithoutMemberRow(
	leaderLabels: ReadonlyArray<string | null>,
	candidatesByKey: ReadonlyMap<string, ReadonlyArray<LeaderCandidate>>,
): string[] {
	const { baseNames } = resolveLeaderLabels(leaderLabels);

	return baseNames.filter(
		(baseName) => (candidatesByKey.get(leaderKey(baseName)) ?? []).length === 0,
	);
}

export function planLeaderLinks({
	insertedIds,
	leaderLabels,
	candidatesByKey,
}: {
	/** Inserted member ids, aligned index-for-index with `leaderLabels`. */
	insertedIds: ReadonlyArray<string>;
	leaderLabels: ReadonlyArray<string | null>;
	candidatesByKey: ReadonlyMap<string, ReadonlyArray<LeaderCandidate>>;
}): ImportPlan {
	const resolution = resolveLeaderLabels(leaderLabels);

	const namesByKey = new Map(
		[...candidatesByKey].map(([key, candidates]) => [
			key,
			candidates.map((candidate) => candidate.name),
		]),
	);

	const ambiguous = findAmbiguousLabels(resolution, namesByKey);
	if (ambiguous.length > 0) return { links: [], ambiguous };

	const links: Array<{ memberId: string; leaderId: string }> = [];

	leaderLabels.forEach((label, index) => {
		const memberId = insertedIds[index];
		if (!label || !memberId) return;

		const [leader] =
			candidatesByKey.get(leaderKey(stripGroupSuffix(label))) ?? [];

		// A member cannot lead themselves; that link is dropped, not an error.
		if (!leader || leader.id === memberId) return;

		links.push({ memberId, leaderId: leader.id });
	});

	return { links, ambiguous: [] };
}
