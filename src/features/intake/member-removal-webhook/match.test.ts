import { describe, expect, it } from "vitest";
import { findNameMatches, normalizeName } from "./match.ts";

describe("normalizeName", () => {
	it("trims, collapses internal whitespace, and lowercases", () => {
		expect(normalizeName("  Ada   Lovelace \n")).toBe("ada lovelace");
	});

	it("is a no-op on an already-normalized name", () => {
		expect(normalizeName("ada lovelace")).toBe("ada lovelace");
	});
});

describe("findNameMatches", () => {
	const ada = { id: "1", name: "Ada Lovelace" };
	const grace = { id: "2", name: "Grace Hopper" };
	const anotherAda = { id: "3", name: "ADA LOVELACE" };

	it("matches an exact name", () => {
		expect(findNameMatches([ada, grace], "Ada", "Lovelace")).toEqual([ada]);
	});

	it("matches regardless of case, on both sides", () => {
		expect(findNameMatches([ada, grace], "ada", "LOVELACE")).toEqual([ada]);
		expect(findNameMatches([anotherAda, grace], "Ada", "Lovelace")).toEqual([
			anotherAda,
		]);
	});

	it("matches through extra or irregular whitespace on both sides", () => {
		expect(
			findNameMatches(
				[{ id: "1", name: "Ada   Lovelace" }, grace],
				"  Ada",
				"Lovelace  ",
			),
		).toEqual([{ id: "1", name: "Ada   Lovelace" }]);
	});

	it("returns every match when the name is ambiguous", () => {
		expect(
			findNameMatches([ada, anotherAda, grace], "Ada", "Lovelace"),
		).toEqual([ada, anotherAda]);
	});

	it("returns an empty array when nobody matches", () => {
		expect(findNameMatches([ada, grace], "Nobody", "Home")).toEqual([]);
	});

	it("returns an empty array over an empty candidate list", () => {
		expect(findNameMatches([], "Ada", "Lovelace")).toEqual([]);
	});

	it("does not match a first-name/surname swap", () => {
		expect(findNameMatches([ada, grace], "Lovelace", "Ada")).toEqual([]);
	});

	it("does not match a substring of a longer name", () => {
		expect(
			findNameMatches(
				[{ id: "4", name: "Ada Lovelace Byron" }],
				"Ada",
				"Lovelace",
			),
		).toEqual([]);
	});
});
