import { describe, expect, it } from "vitest";
import { requiredNameField } from "./name-field.ts";

// Built from its code point (0x200b) rather than a backslash-u escape in a
// string literal — biome silently normalizes that into the actual invisible
// character, which then reads as an empty string to anyone looking at the
// source.
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

describe("requiredNameField", () => {
	const field = requiredNameField("firstName");

	it("accepts an ordinary name", () => {
		expect(field.safeParse("Ada").success).toBe(true);
	});

	it("accepts a name with punctuation, as long as it has a letter", () => {
		expect(field.safeParse("O'Brien").success).toBe(true);
		expect(field.safeParse("Al-Amin").success).toBe(true);
	});

	it("accepts a non-Latin name", () => {
		expect(field.safeParse("Наталья").success).toBe(true);
	});

	it("accepts a single-letter initial", () => {
		expect(field.safeParse("T").success).toBe(true);
	});

	it("rejects an empty string", () => {
		expect(field.safeParse("").success).toBe(false);
	});

	it("rejects whitespace only", () => {
		expect(field.safeParse("   ").success).toBe(false);
	});

	it("rejects a character `.trim()` doesn't strip, like a zero-width space", () => {
		expect(field.safeParse(ZERO_WIDTH_SPACE).success).toBe(false);
	});

	it("rejects punctuation-only placeholder text", () => {
		expect(field.safeParse("-").success).toBe(false);
		expect(field.safeParse("...").success).toBe(false);
	});

	it("accepts a placeholder-looking string that does contain letters, like N/A — not this check's job to guess intent", () => {
		expect(field.safeParse("N/A").success).toBe(true);
	});

	it("rejects digits only", () => {
		expect(field.safeParse("12345").success).toBe(false);
	});

	it("rejects a name over 200 characters", () => {
		expect(field.safeParse("A".repeat(201)).success).toBe(false);
	});
});
