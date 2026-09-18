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

	// A name-less submission used to reach matchPersonForRemoval and land in
	// Removal Requests as an unreadable entry — min(1) after trim() lets all
	// of these through, since none of them is an empty string. The zero-width
	// space (U+200B) is built from its code point rather than a string
	// escape — biome silently normalizes that escape into the actual
	// invisible character.
	it.each([
		"-",
		"...",
		"12345",
		String.fromCharCode(0x200b),
	])('rejects "%s" as a firstName or surname — no actual letter in it', (placeholder) => {
		expect(
			memberRemovalWebhookSchema.safeParse({
				...valid,
				firstName: placeholder,
			}).success,
		).toBe(false);
		expect(
			memberRemovalWebhookSchema.safeParse({ ...valid, surname: placeholder })
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
