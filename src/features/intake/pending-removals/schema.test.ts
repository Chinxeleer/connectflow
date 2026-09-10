import { describe, expect, it } from "vitest";
import {
	dismissPendingRemovalSchema,
	resolvePendingRemovalSchema,
} from "./schema.ts";

const ID = "11111111-1111-4111-8111-111111111111";
const MEMBER_ID = "22222222-2222-4222-8222-222222222222";

describe("resolvePendingRemovalSchema", () => {
	it("accepts two valid uuids", () => {
		expect(
			resolvePendingRemovalSchema.safeParse({
				pendingRemovalId: ID,
				memberId: MEMBER_ID,
			}).success,
		).toBe(true);
	});

	it("rejects a non-uuid pendingRemovalId", () => {
		expect(
			resolvePendingRemovalSchema.safeParse({
				pendingRemovalId: "nope",
				memberId: MEMBER_ID,
			}).success,
		).toBe(false);
	});

	it("rejects a missing memberId", () => {
		expect(
			resolvePendingRemovalSchema.safeParse({ pendingRemovalId: ID }).success,
		).toBe(false);
	});
});

describe("dismissPendingRemovalSchema", () => {
	it("accepts a valid uuid", () => {
		expect(
			dismissPendingRemovalSchema.safeParse({ pendingRemovalId: ID }).success,
		).toBe(true);
	});

	it("rejects a non-uuid", () => {
		expect(
			dismissPendingRemovalSchema.safeParse({ pendingRemovalId: "nope" })
				.success,
		).toBe(false);
	});
});
