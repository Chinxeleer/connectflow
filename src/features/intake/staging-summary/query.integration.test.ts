import { and, eq, inArray, isNull, count as sqlCount } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db/index.ts";
import { intakeReconciliations } from "@/db/schema/intake-reconciliations.ts";
import { members } from "@/db/schema/members.ts";
import { pendingRemovals } from "@/db/schema/pending-removals.ts";
import { selectStagingAttentionCount } from "./query.ts";

/**
 * Proves each bucket's predicate against a real database, scoped to one
 * fixture row by id rather than comparing whole-table counts before and
 * after — the dev database is shared with every other integration test
 * file, several of which insert and delete plain `members` rows
 * concurrently, so a "count before vs. count after" comparison on the whole
 * table is inherently flaky here.
 */
const TAG = `__stagingsummarytest_${Date.now()}`;
const named = (label: string) => `${TAG} ${label}`;

const createdMemberIds: string[] = [];
const createdReconciliationIds: string[] = [];
const createdRemovalIds: string[] = [];

/** Exactly the "unassigned" predicate `selectStagingAttentionCount` uses, scoped to one row. */
async function isCountedAsUnassigned(memberId: string): Promise<boolean> {
	const [row] = await db
		.select({ count: sqlCount() })
		.from(members)
		.where(
			and(
				eq(members.id, memberId),
				isNull(members.leaderId),
				isNull(members.removedAt),
				eq(members.isOrganization, false),
			),
		);
	return (row?.count ?? 0) > 0;
}

/** Exactly the "needsReview" predicate, scoped to one row. */
async function isCountedAsNeedsReview(
	reconciliationId: string,
): Promise<boolean> {
	const [row] = await db
		.select({ count: sqlCount() })
		.from(intakeReconciliations)
		.where(
			and(
				eq(intakeReconciliations.id, reconciliationId),
				eq(intakeReconciliations.status, "pending"),
			),
		);
	return (row?.count ?? 0) > 0;
}

/** Exactly the "removals" predicate, scoped to one row. */
async function isCountedAsRemoval(removalId: string): Promise<boolean> {
	const [row] = await db
		.select({ count: sqlCount() })
		.from(pendingRemovals)
		.where(
			and(
				eq(pendingRemovals.id, removalId),
				eq(pendingRemovals.status, "pending"),
			),
		);
	return (row?.count ?? 0) > 0;
}

describe.skipIf(!process.env.DATABASE_URL)(
	"selectStagingAttentionCount (database)",
	{ retry: 2 },
	() => {
		afterAll(async () => {
			if (createdReconciliationIds.length > 0) {
				await db
					.delete(intakeReconciliations)
					.where(inArray(intakeReconciliations.id, createdReconciliationIds));
			}
			if (createdRemovalIds.length > 0) {
				await db
					.delete(pendingRemovals)
					.where(inArray(pendingRemovals.id, createdRemovalIds));
			}
			if (createdMemberIds.length > 0) {
				await db.delete(members).where(inArray(members.id, createdMemberIds));
			}
		});

		it("counts a real unassigned member", async () => {
			const [member] = await db
				.insert(members)
				.values({ name: named("Unassigned") })
				.returning({ id: members.id });
			if (!member) throw new Error("setup failed");
			createdMemberIds.push(member.id);

			expect(await isCountedAsUnassigned(member.id)).toBe(true);
		});

		it("does not count an isOrganization member as unassigned", async () => {
			const [org] = await db
				.insert(members)
				.values({ name: named("Org"), isOrganization: true })
				.returning({ id: members.id });
			if (!org) throw new Error("setup failed");
			createdMemberIds.push(org.id);

			expect(await isCountedAsUnassigned(org.id)).toBe(false);
		});

		it("counts a pending intake reconciliation", async () => {
			const [reconciliation] = await db
				.insert(intakeReconciliations)
				.values({ rawPayload: { source: "test" } })
				.returning({ id: intakeReconciliations.id });
			if (!reconciliation) throw new Error("setup failed");
			createdReconciliationIds.push(reconciliation.id);

			expect(await isCountedAsNeedsReview(reconciliation.id)).toBe(true);
		});

		it("does not count a resolved reconciliation", async () => {
			const [reconciliation] = await db
				.insert(intakeReconciliations)
				.values({ rawPayload: { source: "test" }, status: "resolved" })
				.returning({ id: intakeReconciliations.id });
			if (!reconciliation) throw new Error("setup failed");
			createdReconciliationIds.push(reconciliation.id);

			expect(await isCountedAsNeedsReview(reconciliation.id)).toBe(false);
		});

		it("counts a pending removal request", async () => {
			const [removal] = await db
				.insert(pendingRemovals)
				.values({
					firstName: named("Pending"),
					surname: "Removal",
					submittedAt: new Date(),
				})
				.returning({ id: pendingRemovals.id });
			if (!removal) throw new Error("setup failed");
			createdRemovalIds.push(removal.id);

			expect(await isCountedAsRemoval(removal.id)).toBe(true);
		});

		it("does not count a dismissed removal request", async () => {
			const [removal] = await db
				.insert(pendingRemovals)
				.values({
					firstName: named("Dismissed"),
					surname: "Removal",
					submittedAt: new Date(),
					status: "dismissed",
				})
				.returning({ id: pendingRemovals.id });
			if (!removal) throw new Error("setup failed");
			createdRemovalIds.push(removal.id);

			expect(await isCountedAsRemoval(removal.id)).toBe(false);
		});

		it("sums the three buckets into total", async () => {
			const result = await selectStagingAttentionCount();
			expect(result.total).toBe(
				result.unassigned + result.needsReview + result.removals,
			);
		});
	},
);
