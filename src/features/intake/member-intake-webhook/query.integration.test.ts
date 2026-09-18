import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { db } from "@/db/index.ts";
import {
	intakeReconciliationCandidates,
	intakeReconciliations,
} from "@/db/schema/intake-reconciliations.ts";
import { members } from "@/db/schema/members.ts";
import { upsertMemberFromIntake } from "./query.ts";
import type { MemberIntakeValues } from "./schema.ts";

/**
 * Proves the three-way outcome against a real database: create when nothing
 * resembles the submission, confidently update the one person a submission
 * resembles (whether corroborated by email or on name alone), and stage a
 * reconciliation rather than guessing when a name resembles more than one
 * person on file.
 */
const TAG = `__intaketest_${Date.now()}`;
const named = (label: string) => `${TAG} ${label}`;

const createdMemberIds: string[] = [];
const createdReconciliationIds: string[] = [];

function baseValues(
	overrides: Partial<MemberIntakeValues> = {},
): MemberIntakeValues {
	return {
		firstName: "Firstname",
		surname: "Surname",
		phone: null,
		email: null,
		gender: null,
		residence: null,
		fieldOfStudy: null,
		yearOfStudy: null,
		ministry: null,
		areaGroup: "main_central",
		submittedAt: new Date(),
		...overrides,
	};
}

describe.skipIf(!process.env.DATABASE_URL)(
	"upsertMemberFromIntake (database)",
	{ retry: 2 },
	() => {
		afterEach(async () => {
			if (createdReconciliationIds.length > 0) {
				await db
					.delete(intakeReconciliationCandidates)
					.where(
						inArray(
							intakeReconciliationCandidates.reconciliationId,
							createdReconciliationIds,
						),
					);
				await db
					.delete(intakeReconciliations)
					.where(inArray(intakeReconciliations.id, createdReconciliationIds));
				createdReconciliationIds.length = 0;
			}
		});

		afterAll(async () => {
			if (createdMemberIds.length > 0) {
				await db.delete(members).where(inArray(members.id, createdMemberIds));
			}
		});

		it("creates a new member when nothing on file resembles the submission", async () => {
			const values = baseValues({
				firstName: named("Ada"),
				surname: "Lovelace",
				email: `${TAG}.ada@example.com`,
			});

			const result = await upsertMemberFromIntake(values, {
				source: "test",
			});
			expect(result.outcome).toBe("created");
			if (result.outcome !== "created") throw new Error("unreachable");
			createdMemberIds.push(result.memberId);

			const [created] = await db
				.select({ name: members.name, email: members.email })
				.from(members)
				.where(eq(members.id, result.memberId));
			expect(created?.name).toBe(`${named("Ada")} Lovelace`);
			expect(created?.email).toBe(`${TAG}.ada@example.com`);
		});

		it("backfills an existing member matched confidently by email and a close name", async () => {
			const email = `${TAG}.grace@example.com`;
			const [existing] = await db
				.insert(members)
				.values({
					name: `${named("Grace")} Hopper`,
					email,
					phone: null,
					residence: null,
				})
				.returning({ id: members.id });
			if (!existing) throw new Error("setup failed");
			createdMemberIds.push(existing.id);

			const values = baseValues({
				firstName: named("Grace"),
				surname: "Hopper",
				email,
				residence: "Hall 3",
			});

			const result = await upsertMemberFromIntake(values, {
				source: "test",
			});
			expect(result.outcome).toBe("updated");
			if (result.outcome !== "updated") throw new Error("unreachable");
			expect(result.memberId).toBe(existing.id);
			expect(result.backfilledFields).toContain("residence");

			const [after] = await db
				.select({ residence: members.residence })
				.from(members)
				.where(eq(members.id, existing.id));
			expect(after?.residence).toBe("Hall 3");
		});

		it("auto-applies a name-only match to the one person it resembles", async () => {
			// Deliberately not derived from the shared TAG — two names built from
			// the same long prefix are, by construction, similar to *each other*
			// under a length-relative threshold, which would wrongly draw this
			// test's fixture into the next test's ambiguous-match scenario.
			const name = "Zqxvantauto Wumbleford";
			// A retried attempt would otherwise re-insert alongside a prior
			// attempt's still-present row, turning a one-candidate match into an
			// ambiguous one and failing for an unrelated reason.
			await db.delete(members).where(eq(members.name, name));

			const [existing] = await db
				.insert(members)
				.values({ name, email: null, phone: null, residence: null })
				.returning({ id: members.id });
			if (!existing) throw new Error("setup failed");
			createdMemberIds.push(existing.id);

			const values = baseValues({
				firstName: "Zqxvantauto",
				surname: "Wumbleford",
				residence: "Hall 9",
			});

			const result = await upsertMemberFromIntake(values, {
				source: "test",
			});
			expect(result.outcome).toBe("updated");
			if (result.outcome !== "updated") throw new Error("unreachable");
			expect(result.memberId).toBe(existing.id);

			const [after] = await db
				.select({ residence: members.residence })
				.from(members)
				.where(eq(members.id, existing.id));
			expect(after?.residence).toBe("Hall 9");
		});

		it("stages a reconciliation when a name-only match resembles two different people, and touches no member record", async () => {
			const name = "Krillmulti Panthergax";
			await db.delete(members).where(eq(members.name, name));

			const [first, second] = await db
				.insert(members)
				.values([
					{ name, email: null, phone: null, residence: "Hall 1" },
					{ name, email: null, phone: null, residence: "Hall 2" },
				])
				.returning({ id: members.id });
			if (!first || !second) throw new Error("setup failed");
			createdMemberIds.push(first.id, second.id);

			const values = baseValues({
				firstName: "Krillmulti",
				surname: "Panthergax",
				residence: "Hall 9",
			});

			const result = await upsertMemberFromIntake(values, {
				source: "test",
			});
			expect(result.outcome).toBe("needs_review");
			if (result.outcome !== "needs_review") throw new Error("unreachable");
			expect(result.candidateCount).toBe(2);
			createdReconciliationIds.push(result.reconciliationId);

			const candidateRows = await db
				.select({ personId: intakeReconciliationCandidates.personId })
				.from(intakeReconciliationCandidates)
				.where(
					eq(
						intakeReconciliationCandidates.reconciliationId,
						result.reconciliationId,
					),
				);
			expect(candidateRows.map((row) => row.personId).sort()).toEqual(
				[first.id, second.id].sort(),
			);

			const untouched = await db
				.select({ id: members.id, residence: members.residence })
				.from(members)
				.where(inArray(members.id, [first.id, second.id]));
			expect(untouched.map((row) => row.residence).sort()).toEqual([
				"Hall 1",
				"Hall 2",
			]);
		});
	},
);
