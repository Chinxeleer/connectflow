import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/index.ts";
import { user } from "@/db/schema/auth.ts";
import { intakeReconciliations } from "@/db/schema/intake-reconciliations.ts";
import { members } from "@/db/schema/members.ts";
import { upsertMemberFromIntake } from "@/features/intake/member-intake-webhook/query.ts";
import type { MemberIntakeValues } from "@/features/intake/member-intake-webhook/schema.ts";
import { compareIntakeFields, isApplyAllEligible } from "./field-comparison.ts";
import {
	discardReconciliation,
	resolveReconciliationAsNew,
	resolveReconciliationAsUpdate,
} from "./query.ts";

/**
 * Proves the three resolution paths against a real database: a blank-fill
 * patch applies automatically, a conflict field only changes when the admin
 * explicitly chose "use new", and the `status = 'pending'` guard stops a
 * reconciliation from being resolved twice.
 */
const TAG = `__pendingintaketest_${Date.now()}`;
const named = (label: string) => `${TAG} ${label}`;

const createdMemberIds: string[] = [];
const createdReconciliationIds: string[] = [];
let actorId = "";

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

/** The pre-transform shape `memberIntakeSchema.parse` expects, since that's what's actually stored as `rawPayload`. */
function webhookPayloadFrom(values: MemberIntakeValues) {
	return {
		firstName: values.firstName,
		surname: values.surname,
		phone: values.phone ?? "",
		email: values.email ?? "",
		gender: values.gender ?? "",
		residence: values.residence ?? "",
		fieldOfStudy: values.fieldOfStudy ?? "",
		yearOfStudy: values.yearOfStudy ?? "",
		ministry: values.ministry ?? "",
		areaGroup: values.areaGroup,
		submittedAt: values.submittedAt.toISOString(),
	};
}

/** Stages a NEEDS_REVIEW reconciliation against whatever candidates the real matcher finds. */
async function stageReconciliation(values: MemberIntakeValues) {
	const result = await upsertMemberFromIntake(
		values,
		webhookPayloadFrom(values),
	);
	if (result.outcome !== "needs_review") {
		throw new Error(`Expected needs_review, got ${result.outcome}`);
	}
	createdReconciliationIds.push(result.reconciliationId);
	return result.reconciliationId;
}

describe.skipIf(!process.env.DATABASE_URL)(
	"pending-intake resolution (database)",
	{ retry: 2 },
	() => {
		beforeAll(async () => {
			const [createdUser] = await db
				.insert(user)
				.values({
					id: `${TAG}_admin`,
					name: named("Admin"),
					email: `${TAG}.admin@example.com`,
					role: "admin",
				})
				.returning({ id: user.id });
			actorId = createdUser?.id ?? "";
		});

		afterEach(async () => {
			if (createdReconciliationIds.length > 0) {
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
			if (actorId) {
				await db.delete(user).where(eq(user.id, actorId));
			}
		});

		it("applies a blank-fill patch and marks the reconciliation resolved", async () => {
			const [existing] = await db
				.insert(members)
				.values({ name: `${named("Precious")} Ndlovu`, residence: null })
				.returning({ id: members.id });
			if (!existing) throw new Error("setup failed");
			createdMemberIds.push(existing.id);

			const reconciliationId = await stageReconciliation(
				baseValues({
					firstName: named("Precious"),
					surname: "Ndlovu",
					residence: "Hall 4",
				}),
			);

			const comparisons = compareIntakeFields(
				{
					phone: null,
					email: null,
					gender: null,
					residence: null,
					fieldOfStudy: null,
					areaGroup: null,
					yearOfStudy: null,
					ministry: null,
				},
				{
					phone: null,
					email: null,
					gender: null,
					residence: "Hall 4",
					fieldOfStudy: null,
					areaGroup: null,
					yearOfStudy: null,
					ministry: null,
				},
			);
			expect(isApplyAllEligible(comparisons)).toBe(true);

			await resolveReconciliationAsUpdate({
				reconciliationId,
				personId: existing.id,
				patch: { residence: "Hall 4" },
				actorId,
			});

			const [afterMember] = await db
				.select({ residence: members.residence })
				.from(members)
				.where(eq(members.id, existing.id));
			expect(afterMember?.residence).toBe("Hall 4");

			const [afterReconciliation] = await db
				.select({
					status: intakeReconciliations.status,
					resolution: intakeReconciliations.resolution,
					resolvedBy: intakeReconciliations.resolvedBy,
				})
				.from(intakeReconciliations)
				.where(eq(intakeReconciliations.id, reconciliationId));
			expect(afterReconciliation?.status).toBe("resolved");
			expect(afterReconciliation?.resolution).toBe("updated_existing");
			expect(afterReconciliation?.resolvedBy).toBe(actorId);
		});

		it("leaves a conflicting field alone when the patch doesn't include it (kept, not used-new)", async () => {
			const [existing] = await db
				.insert(members)
				.values({ name: `${named("Grace")} Hopper`, gender: "female" })
				.returning({ id: members.id });
			if (!existing) throw new Error("setup failed");
			createdMemberIds.push(existing.id);

			const reconciliationId = await stageReconciliation(
				baseValues({
					firstName: named("Grace"),
					surname: "Hopper",
					gender: "male",
				}),
			);

			// Admin chose "keep existing" for the conflicting gender field — the
			// patch is empty, mirroring what the resolve dialog sends when every
			// conflict toggle stays on "keep".
			await resolveReconciliationAsUpdate({
				reconciliationId,
				personId: existing.id,
				patch: {},
				actorId,
			});

			const [afterMember] = await db
				.select({ gender: members.gender })
				.from(members)
				.where(eq(members.id, existing.id));
			expect(afterMember?.gender).toBe("female");
		});

		it("applies a conflicting field when the patch includes it (use-new chosen)", async () => {
			const [existing] = await db
				.insert(members)
				.values({ name: `${named("Mary")} Jackson`, gender: "female" })
				.returning({ id: members.id });
			if (!existing) throw new Error("setup failed");
			createdMemberIds.push(existing.id);

			const reconciliationId = await stageReconciliation(
				baseValues({
					firstName: named("Mary"),
					surname: "Jackson",
					gender: "male",
				}),
			);

			await resolveReconciliationAsUpdate({
				reconciliationId,
				personId: existing.id,
				patch: { gender: "male" },
				actorId,
			});

			const [afterMember] = await db
				.select({ gender: members.gender })
				.from(members)
				.where(eq(members.id, existing.id));
			expect(afterMember?.gender).toBe("male");
		});

		it("refuses to resolve a reconciliation that's already been handled", async () => {
			const [existing] = await db
				.insert(members)
				.values({ name: `${named("Katherine")} Johnson` })
				.returning({ id: members.id });
			if (!existing) throw new Error("setup failed");
			createdMemberIds.push(existing.id);

			const reconciliationId = await stageReconciliation(
				baseValues({ firstName: named("Katherine"), surname: "Johnson" }),
			);

			await discardReconciliation({ reconciliationId, actorId });

			await expect(
				resolveReconciliationAsUpdate({
					reconciliationId,
					personId: existing.id,
					patch: {},
					actorId,
				}),
			).rejects.toThrow("already been handled");
		});

		it("creates a new person from the original submission and marks the reconciliation resolved", async () => {
			const [existing] = await db
				.insert(members)
				.values({ name: `${named("Dorothy")} Vaughan` })
				.returning({ id: members.id });
			if (!existing) throw new Error("setup failed");
			createdMemberIds.push(existing.id);

			const reconciliationId = await stageReconciliation(
				baseValues({
					firstName: named("Dorothy"),
					surname: "Vaughan",
					fieldOfStudy: "Physics",
				}),
			);

			const { memberId } = await resolveReconciliationAsNew({
				reconciliationId,
				actorId,
			});
			createdMemberIds.push(memberId);

			expect(memberId).not.toBe(existing.id);

			const [created] = await db
				.select({ name: members.name, fieldOfStudy: members.fieldOfStudy })
				.from(members)
				.where(eq(members.id, memberId));
			expect(created?.name).toBe(`${named("Dorothy")} Vaughan`);
			expect(created?.fieldOfStudy).toBe("Physics");

			const [afterReconciliation] = await db
				.select({
					status: intakeReconciliations.status,
					resolution: intakeReconciliations.resolution,
					resolvedMemberId: intakeReconciliations.resolvedMemberId,
				})
				.from(intakeReconciliations)
				.where(eq(intakeReconciliations.id, reconciliationId));
			expect(afterReconciliation?.status).toBe("resolved");
			expect(afterReconciliation?.resolution).toBe("created_new");
			expect(afterReconciliation?.resolvedMemberId).toBe(memberId);
		});

		it("discards a reconciliation without touching any member record", async () => {
			const [existing] = await db
				.insert(members)
				.values({ name: `${named("Annie")} Easley`, residence: "Hall 2" })
				.returning({ id: members.id });
			if (!existing) throw new Error("setup failed");
			createdMemberIds.push(existing.id);

			const reconciliationId = await stageReconciliation(
				baseValues({ firstName: named("Annie"), surname: "Easley" }),
			);

			await discardReconciliation({ reconciliationId, actorId });

			const [afterMember] = await db
				.select({ residence: members.residence })
				.from(members)
				.where(eq(members.id, existing.id));
			expect(afterMember?.residence).toBe("Hall 2");

			const [afterReconciliation] = await db
				.select({
					status: intakeReconciliations.status,
					resolution: intakeReconciliations.resolution,
					resolvedMemberId: intakeReconciliations.resolvedMemberId,
				})
				.from(intakeReconciliations)
				.where(eq(intakeReconciliations.id, reconciliationId));
			expect(afterReconciliation?.status).toBe("resolved");
			expect(afterReconciliation?.resolution).toBe("discarded");
			expect(afterReconciliation?.resolvedMemberId).toBeNull();
		});
	},
);
