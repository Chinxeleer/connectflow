import { describe, expect, it } from "vitest";
import { resetPasswordSchema } from "./schema.ts";

describe("resetPasswordSchema", () => {
	it("accepts matching passwords of sufficient length", () => {
		expect(
			resetPasswordSchema.safeParse({
				newPassword: "a-long-enough-password",
				confirmPassword: "a-long-enough-password",
			}).success,
		).toBe(true);
	});

	it("rejects a password shorter than 8 characters", () => {
		expect(
			resetPasswordSchema.safeParse({
				newPassword: "short1",
				confirmPassword: "short1",
			}).success,
		).toBe(false);
	});

	it("rejects mismatched passwords", () => {
		const result = resetPasswordSchema.safeParse({
			newPassword: "a-long-enough-password",
			confirmPassword: "a-different-password",
		});
		expect(result.success).toBe(false);
	});
});
