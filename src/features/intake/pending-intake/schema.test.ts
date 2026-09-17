import { describe, expect, it } from "vitest";
import {
	discardReconciliationSchema,
	intakeFieldPatchSchema,
	resolveAsCreateNewSchema,
	resolveAsUpdateExistingSchema,
} from "./schema.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const PERSON_ID = "22222222-2222-4222-8222-222222222222";

describe("intakeFieldPatchSchema", () => {
	it("accepts an empty patch", () => {
		expect(intakeFieldPatchSchema.safeParse({}).success).toBe(true);
	});

	it("accepts a partial patch of just some fields", () => {
		expect(
			intakeFieldPatchSchema.safeParse({ phone: "0700000000", gender: "male" })
				.success,
		).toBe(true);
	});

	it("rejects an areaGroup outside the fixed set", () => {
		expect(
			intakeFieldPatchSchema.safeParse({ areaGroup: "nowhere" }).success,
		).toBe(false);
	});

	it("rejects a yearOfStudy outside the fixed set", () => {
		expect(
			intakeFieldPatchSchema.safeParse({ yearOfStudy: "year_9" }).success,
		).toBe(false);
	});

	it("accepts valid areaGroup and yearOfStudy values", () => {
		expect(
			intakeFieldPatchSchema.safeParse({
				areaGroup: "main_central",
				yearOfStudy: "year_1",
			}).success,
		).toBe(true);
	});
});

describe("resolveAsUpdateExistingSchema", () => {
	it("accepts a valid payload", () => {
		expect(
			resolveAsUpdateExistingSchema.safeParse({
				reconciliationId: ID,
				personId: PERSON_ID,
				patch: { phone: "0700000000" },
			}).success,
		).toBe(true);
	});

	it("accepts an empty patch — nothing needed applying", () => {
		expect(
			resolveAsUpdateExistingSchema.safeParse({
				reconciliationId: ID,
				personId: PERSON_ID,
				patch: {},
			}).success,
		).toBe(true);
	});

	it("rejects a non-uuid reconciliationId or personId", () => {
		expect(
			resolveAsUpdateExistingSchema.safeParse({
				reconciliationId: "nope",
				personId: PERSON_ID,
				patch: {},
			}).success,
		).toBe(false);
		expect(
			resolveAsUpdateExistingSchema.safeParse({
				reconciliationId: ID,
				personId: "nope",
				patch: {},
			}).success,
		).toBe(false);
	});
});

describe("resolveAsCreateNewSchema", () => {
	it("accepts a valid reconciliationId", () => {
		expect(
			resolveAsCreateNewSchema.safeParse({ reconciliationId: ID }).success,
		).toBe(true);
	});

	it("rejects a non-uuid reconciliationId", () => {
		expect(
			resolveAsCreateNewSchema.safeParse({ reconciliationId: "nope" }).success,
		).toBe(false);
	});
});

describe("discardReconciliationSchema", () => {
	it("accepts a valid reconciliationId", () => {
		expect(
			discardReconciliationSchema.safeParse({ reconciliationId: ID }).success,
		).toBe(true);
	});

	it("rejects a non-uuid reconciliationId", () => {
		expect(
			discardReconciliationSchema.safeParse({ reconciliationId: "nope" })
				.success,
		).toBe(false);
	});
});
