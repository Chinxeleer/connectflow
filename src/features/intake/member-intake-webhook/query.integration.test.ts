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
 * Proves the three-way outcome against a real database — the key behavior
 * change this replaced the old matcher for: a name match alone, however
 * close, must never silently update someone, and an ambiguous submission
 * must stage a reconciliation rather than guessing.
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

		it("stages a reconciliation for a name-only match and touches no member record", async () => {
			const [existing] = await db
				.insert(members)
				.values({
					name: `${named("Precious")} Ndlovu`,
					email: null,
					phone: null,
					residence: "Hall 1",
				})
				.returning({ id: members.id });
			if (!existing) throw new Error("setup failed");
			createdMemberIds.push(existing.id);

			const values = baseValues({
				firstName: named("Precious"),
				surname: "Ndlovu",
				residence: "Hall 9",
			});

			const result = await upsertMemberFromIntake(values, {
				source: "test",
			});
			expect(result.outcome).toBe("needs_review");
			if (result.outcome !== "needs_review") throw new Error("unreachable");
			expect(result.candidateCount).toBe(1);
			createdReconciliationIds.push(result.reconciliationId);

			const [candidate] = await db
				.select({ personId: intakeReconciliationCandidates.personId })
				.from(intakeReconciliationCandidates)
				.where(
					eq(
						intakeReconciliationCandidates.reconciliationId,
						result.reconciliationId,
					),
				);
			expect(candidate?.personId).toBe(existing.id);

			const [after] = await db
				.select({ residence: members.residence })
				.from(members)
				.where(eq(members.id, existing.id));
			expect(after?.residence).toBe("Hall 1");
		});
	},
);
