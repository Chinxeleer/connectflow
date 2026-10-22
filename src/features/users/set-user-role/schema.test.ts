import { describe, expect, it } from "vitest";
import { setUserRoleSchema } from "./schema.ts";

describe("setUserRoleSchema", () => {
	it("accepts a valid userId and role", () => {
		expect(
			setUserRoleSchema.safeParse({ userId: "abc123", role: "admin" }).success,
		).toBe(true);
		expect(
			setUserRoleSchema.safeParse({ userId: "abc123", role: "leader" }).success,
		).toBe(true);
	});

	it("rejects a blank userId", () => {
		expect(
			setUserRoleSchema.safeParse({ userId: "", role: "admin" }).success,
		).toBe(false);
	});

	it("rejects a role outside the known enum", () => {
		expect(
			setUserRoleSchema.safeParse({ userId: "abc123", role: "superadmin" })
				.success,
		).toBe(false);
	});
});
