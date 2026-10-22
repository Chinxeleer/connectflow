import { describe, expect, it } from "vitest";
import { isProtectedAdmin } from "./protected-accounts.ts";

describe("isProtectedAdmin", () => {
	it("recognises the protected account's email", () => {
		expect(isProtectedAdmin("blessingeleer@gmail.com")).toBe(true);
	});

	it("is case-insensitive", () => {
		expect(isProtectedAdmin("Blessingeleer@Gmail.com")).toBe(true);
	});

	it("returns false for any other email", () => {
		expect(isProtectedAdmin("someone-else@example.com")).toBe(false);
	});
});
