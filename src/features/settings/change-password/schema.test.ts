import { describe, expect, it } from "vitest";
import { changePasswordSchema } from "./schema.ts";

describe("changePasswordSchema", () => {
	it("accepts matching passwords of sufficient length", () => {
		expect(
			changePasswordSchema.safeParse({
				currentPassword: "old-password",
				newPassword: "a-long-enough-password",
				confirmPassword: "a-long-enough-password",
			}).success,
		).toBe(true);
	});

	it("rejects a blank current password", () => {
		expect(
			changePasswordSchema.safeParse({
				currentPassword: "",
				newPassword: "a-long-enough-password",
				confirmPassword: "a-long-enough-password",
			}).success,
		).toBe(false);
	});

	it("rejects a new password shorter than 8 characters", () => {
		expect(
			changePasswordSchema.safeParse({
				currentPassword: "old-password",
				newPassword: "short1",
				confirmPassword: "short1",
			}).success,
		).toBe(false);
	});

	it("rejects mismatched new/confirm passwords", () => {
		expect(
			changePasswordSchema.safeParse({
				currentPassword: "old-password",
				newPassword: "a-long-enough-password",
				confirmPassword: "a-different-password",
			}).success,
		).toBe(false);
	});
});
