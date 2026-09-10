import { describe, expect, it } from "vitest";
import { findFullNameMatches } from "./match.ts";

describe("findFullNameMatches", () => {
	const ada = { id: "1", name: "Ada Lovelace" };
	const grace = { id: "2", name: "Grace Hopper" };
	const anotherAda = { id: "3", name: "ADA LOVELACE" };

	it("matches an exact name", () => {
		expect(findFullNameMatches([ada, grace], "Ada Lovelace")).toEqual([ada]);
	});

	it("matches regardless of case", () => {
		expect(findFullNameMatches([ada, grace], "ada lovelace")).toEqual([ada]);
	});

	it("matches through extra or irregular whitespace on either side", () => {
		expect(
			findFullNameMatches(
				[{ id: "1", name: "Ada   Lovelace" }, grace],
				"  Ada Lovelace  ",
			),
		).toEqual([{ id: "1", name: "Ada   Lovelace" }]);
	});

	it("returns every match when the name is ambiguous", () => {
		expect(
			findFullNameMatches([ada, anotherAda, grace], "Ada Lovelace"),
		).toEqual([ada, anotherAda]);
	});

	it("returns an empty array when nobody matches", () => {
		expect(findFullNameMatches([ada, grace], "Nobody Home")).toEqual([]);
	});

	it("returns an empty array over an empty candidate list", () => {
		expect(findFullNameMatches([], "Ada Lovelace")).toEqual([]);
	});

	it("does not match a substring of a longer name", () => {
		expect(
			findFullNameMatches(
				[{ id: "4", name: "Ada Lovelace Byron" }],
				"Ada Lovelace",
			),
		).toEqual([]);
	});
});
