import { describe, expect, it } from "vitest";
import { memberRemovalSchema, memberRemovalWebhookSchema } from "./schema.ts";

const valid = {
	firstName: "Ada",
	surname: "Lovelace",
	submittedAt: "2026-09-10T12:00:00Z",
};

describe("memberRemovalWebhookSchema", () => {
	it("accepts a fully populated payload", () => {
		expect(memberRemovalWebhookSchema.safeParse(valid).success).toBe(true);
	});

	it("requires a non-empty firstName", () => {
		expect(
			memberRemovalWebhookSchema.safeParse({ ...valid, firstName: "" }).success,
		).toBe(false);
	});

	it("requires a non-empty surname", () => {
		expect(
			memberRemovalWebhookSchema.safeParse({ ...valid, surname: "" }).success,
		).toBe(false);
	});

	it("rejects a missing firstName or surname key outright", () => {
		const { firstName: _omitted, ...withoutFirstName } = valid;
		expect(memberRemovalWebhookSchema.safeParse(withoutFirstName).success).toBe(
			false,
		);
	});

	it("trims whitespace-only names to empty and rejects them", () => {
		expect(
			memberRemovalWebhookSchema.safeParse({ ...valid, firstName: "   " })
				.success,
		).toBe(false);
	});

	it("rejects a submittedAt that is not a valid ISO datetime", () => {
		expect(
			memberRemovalWebhookSchema.safeParse({ ...valid, submittedAt: "nope" })
				.success,
		).toBe(false);
	});
});

describe("memberRemovalSchema", () => {
	it("trims names and parses submittedAt into a Date", () => {
		const parsed = memberRemovalSchema.parse({
			...valid,
			firstName: "  Ada ",
			surname: " Lovelace  ",
		});

		expect(parsed.firstName).toBe("Ada");
		expect(parsed.surname).toBe("Lovelace");
		expect(parsed.submittedAt).toBeInstanceOf(Date);
	});
});
