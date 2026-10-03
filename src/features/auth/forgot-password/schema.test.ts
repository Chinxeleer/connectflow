import { describe, expect, it } from "vitest";
import { forgotPasswordSchema } from "./schema.ts";

describe("forgotPasswordSchema", () => {
	it("accepts a valid email", () => {
		expect(
			forgotPasswordSchema.safeParse({ email: "ada@example.com" }).success,
		).toBe(true);
	});

	it("rejects an invalid email", () => {
		expect(
			forgotPasswordSchema.safeParse({ email: "not-an-email" }).success,
		).toBe(false);
	});

	it("rejects a blank email", () => {
		expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
	});
});
