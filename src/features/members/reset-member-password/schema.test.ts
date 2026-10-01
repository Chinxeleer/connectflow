import { describe, expect, it } from "vitest";
import { resetMemberPasswordSchema } from "./schema.ts";

describe("resetMemberPasswordSchema", () => {
	it("accepts a member id", () => {
		const result = resetMemberPasswordSchema.safeParse({
			memberId: "11111111-1111-4111-8111-111111111111",
		});
		expect(result.success).toBe(true);
	});

	it("rejects a non-uuid member id", () => {
		const result = resetMemberPasswordSchema.safeParse({
			memberId: "not-a-uuid",
		});
		expect(result.success).toBe(false);
	});
});
