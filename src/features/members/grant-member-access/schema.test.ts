import { describe, expect, it } from "vitest";
import { grantMemberAccessSchema } from "./schema.ts";

describe("grantMemberAccessSchema", () => {
	it("accepts a member id and email", () => {
		const result = grantMemberAccessSchema.safeParse({
			memberId: "11111111-1111-4111-8111-111111111111",
			email: "ada@example.com",
		});
		expect(result.success).toBe(true);
	});

	it("rejects a non-uuid member id", () => {
		const result = grantMemberAccessSchema.safeParse({
			memberId: "not-a-uuid",
			email: "ada@example.com",
		});
		expect(result.success).toBe(false);
	});

	it("rejects an invalid email", () => {
		const result = grantMemberAccessSchema.safeParse({
			memberId: "11111111-1111-4111-8111-111111111111",
			email: "not-an-email",
		});
		expect(result.success).toBe(false);
	});
});
