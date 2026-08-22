import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import {
	ImportFormatError,
	type LeaderCandidate,
	leadersWithoutMemberRow,
	parseImport,
	planLeaderLinks,
	type RowIssue,
} from "./build-import.ts";
import {
	type AmbiguousLeaderLabel,
	leaderKey,
	resolveLeaderLabels,
} from "./csv-mapping.ts";

export type ImportResult =
	| {
			status: "imported";
			inserted: number;
			linked: number;
			unassigned: number;
			/** Leaders named in the file that had no member row, now created. */
			leadersCreated: string[];
			issues: RowIssue[];
	  }
	| { status: "needs-review"; ambiguous: AmbiguousLeaderLabel[] };

/** Raised to roll the transaction back once ambiguity is known. */
class AmbiguousImportError extends Error {
	constructor(readonly ambiguous: AmbiguousLeaderLabel[]) {
		super("Import halted: leader names need review.");
	}
}

/**
 * The import itself, with no session or request involved so it can be tested
 * directly. Permission is the caller's job — see `action.ts`.
 *
 * Two passes inside one transaction:
 *   1. insert every row unlinked, so a leader introduced by this same file
 *      exists by the time links are resolved;
 *   2. resolve each leader label to exactly one member and write the links.
 *
 * Any ambiguous label rolls the whole transaction back, inserts included. A
 * half-imported sheet is worse than none, because the half that linked looks
 * correct.
 */
export async function runMemberImport(csv: string): Promise<ImportResult> {
	const parsed = parseImport(csv);

	if (parsed.rows.length === 0) {
		throw new ImportFormatError(
			"No valid member rows in that file. Check the Name column.",
		);
	}

	try {
		return await db.transaction(async (tx) => {
			const inserted = await tx
				.insert(members)
				.values(
					parsed.rows.map((row) => ({
						name: row.name,
						phone: row.phone,
						email: row.email,
						gender: row.gender,
						residence: row.residence,
						fieldOfStudy: row.fieldOfStudy,
						status: row.status,
					})),
				)
				.returning({ id: members.id });

			const insertedIds = inserted.map((row) => row.id);
			const { baseNames } = resolveLeaderLabels(parsed.leaderLabels);
			const candidatesByKey = new Map<string, LeaderCandidate[]>();

			if (baseNames.length > 0) {
				const wanted = new Set(baseNames.map(leaderKey));
				const existing = await tx
					.select({ id: members.id, name: members.name })
					.from(members);

				for (const candidate of existing) {
					const key = leaderKey(candidate.name);
					if (!wanted.has(key)) continue;

					const bucket = candidatesByKey.get(key) ?? [];
					bucket.push(candidate);
					candidatesByKey.set(key, bucket);
				}
			}

			// A leader named in the file with no member row of their own is the
			// top of the tree — a leader *is* a member, so create them rather
			// than rejecting the file. Reported back, never silent. A name
			// matching several members is still a genuine guess and halts below.
			const missing = leadersWithoutMemberRow(
				parsed.leaderLabels,
				candidatesByKey,
			);

			if (missing.length > 0) {
				const created = await tx
					.insert(members)
					.values(missing.map((name: string) => ({ name })))
					.returning({ id: members.id, name: members.name });

				for (const candidate of created) {
					candidatesByKey.set(leaderKey(candidate.name), [candidate]);
				}
			}

			const plan = planLeaderLinks({
				insertedIds,
				leaderLabels: parsed.leaderLabels,
				candidatesByKey,
			});

			if (plan.ambiguous.length > 0) {
				throw new AmbiguousImportError(plan.ambiguous);
			}

			for (const link of plan.links) {
				await tx
					.update(members)
					.set({ leaderId: link.leaderId })
					.where(eq(members.id, link.memberId));
			}

			return {
				status: "imported" as const,
				inserted: insertedIds.length + missing.length,
				linked: plan.links.length,
				unassigned: insertedIds.length + missing.length - plan.links.length,
				leadersCreated: missing,
				issues: parsed.issues,
			};
		});
	} catch (error) {
		if (error instanceof AmbiguousImportError) {
			return { status: "needs-review", ambiguous: error.ambiguous };
		}
		throw error;
	}
}

/** Exported for tests that need to clean up their own fixtures. */
export async function deleteMembersByIds(ids: string[]) {
	if (ids.length === 0) return;
	await db
		.update(members)
		.set({ leaderId: null })
		.where(inArray(members.id, ids));
	await db.delete(members).where(inArray(members.id, ids));
}
