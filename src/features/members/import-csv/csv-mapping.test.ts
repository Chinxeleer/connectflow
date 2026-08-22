import { describe, expect, it } from "vitest";
import {
	findAmbiguousLabels,
	forwardFill,
	leaderKey,
	normaliseWhitespace,
	resolveLeaderLabels,
	stripGroupSuffix,
} from "./csv-mapping.ts";

describe("normaliseWhitespace", () => {
	it("collapses runs of whitespace and trims", () => {
		expect(normaliseWhitespace("  Grace   Hopper \n")).toBe("Grace Hopper");
	});

	it("leaves internal casing alone", () => {
		expect(normaliseWhitespace("grace HOPPER")).toBe("grace HOPPER");
	});
});

describe("stripGroupSuffix", () => {
	it.each([
		["Grace Hopper - Group A", "Grace Hopper"],
		["Grace Hopper – Group A", "Grace Hopper"],
		["Grace Hopper — Group 2", "Grace Hopper"],
		["Grace Hopper (Group B)", "Grace Hopper"],
		["Grace Hopper [Group 3]", "Grace Hopper"],
		["Grace Hopper Group 1", "Grace Hopper"],
		["Grace Hopper GRP 4", "Grace Hopper"],
		["Grace Hopper - grp c", "Grace Hopper"],
		["Grace Hopper - Connect 2", "Grace Hopper"],
		["Grace Hopper - CG 5", "Grace Hopper"],
		["  Grace   Hopper  -  Group  A  ", "Grace Hopper"],
	])("strips %j to %j", (input, expected) => {
		expect(stripGroupSuffix(input)).toBe(expected);
	});

	it("leaves a plain name untouched", () => {
		expect(stripGroupSuffix("Grace Hopper")).toBe("Grace Hopper");
	});

	it("does not rewrite a label appearing mid-name", () => {
		expect(stripGroupSuffix("Group Captain Mainwaring")).toBe(
			"Group Captain Mainwaring",
		);
	});

	it("keeps the original when stripping would leave nothing", () => {
		// "Group A" is a label, not a person — the caller must see it and
		// report it, rather than receiving an empty string.
		expect(stripGroupSuffix("Group A")).toBe("Group A");
	});

	it("does not strip a surname that merely starts with the letter g", () => {
		expect(stripGroupSuffix("Ada Grant")).toBe("Ada Grant");
	});
});

describe("forwardFill", () => {
	it("carries the last non-blank value down the column", () => {
		expect(
			forwardFill(["Grace Hopper", "", "", "Alan Turing", "", null, undefined]),
		).toEqual([
			"Grace Hopper",
			"Grace Hopper",
			"Grace Hopper",
			"Alan Turing",
			"Alan Turing",
			"Alan Turing",
			"Alan Turing",
		]);
	});

	it("leaves leading blanks null rather than guessing", () => {
		expect(forwardFill(["", "  ", "Grace Hopper", ""])).toEqual([
			null,
			null,
			"Grace Hopper",
			"Grace Hopper",
		]);
	});

	it("treats a whitespace-only cell as blank", () => {
		expect(forwardFill(["Grace Hopper", "   "])).toEqual([
			"Grace Hopper",
			"Grace Hopper",
		]);
	});

	it("normalises the value it carries", () => {
		expect(forwardFill(["  Grace   Hopper  ", ""])).toEqual([
			"Grace Hopper",
			"Grace Hopper",
		]);
	});

	it("returns an empty array for an empty column", () => {
		expect(forwardFill([])).toEqual([]);
	});
});

describe("resolveLeaderLabels", () => {
	it("groups several group-labels under one base name", () => {
		const result = resolveLeaderLabels([
			"Grace Hopper - Group A",
			"Grace Hopper - Group B",
			"Alan Turing",
		]);

		expect(result.baseNames).toEqual(["Grace Hopper", "Alan Turing"]);
		expect(result.labelsByBaseName.get(leaderKey("Grace Hopper"))).toEqual([
			"Grace Hopper - Group A",
			"Grace Hopper - Group B",
		]);
	});

	it("matches base names case-insensitively", () => {
		const result = resolveLeaderLabels(["GRACE HOPPER", "grace hopper"]);
		expect(result.baseNames).toHaveLength(1);
	});

	it("ignores nulls from unfilled leading rows", () => {
		const result = resolveLeaderLabels([null, "Alan Turing", null]);
		expect(result.baseNames).toEqual(["Alan Turing"]);
	});
});

describe("findAmbiguousLabels", () => {
	const resolution = resolveLeaderLabels([
		"Grace Hopper - Group A",
		"Ada Lovelace",
		"Alan Turing",
	]);

	it("passes a base name matching exactly one member", () => {
		const ambiguous = findAmbiguousLabels(
			resolution,
			new Map([
				[leaderKey("Grace Hopper"), ["Grace Hopper"]],
				[leaderKey("Ada Lovelace"), ["Ada Lovelace"]],
				[leaderKey("Alan Turing"), ["Alan Turing"]],
			]),
		);

		expect(ambiguous).toEqual([]);
	});

	it("reports a base name that matches nothing", () => {
		const ambiguous = findAmbiguousLabels(
			resolution,
			new Map([
				[leaderKey("Ada Lovelace"), ["Ada Lovelace"]],
				[leaderKey("Alan Turing"), ["Alan Turing"]],
			]),
		);

		expect(ambiguous).toHaveLength(1);
		expect(ambiguous[0]).toMatchObject({
			baseName: "Grace Hopper",
			reason: "no-match",
			labels: ["Grace Hopper - Group A"],
		});
	});

	it("reports a base name matching more than one member, with candidates", () => {
		const ambiguous = findAmbiguousLabels(
			resolution,
			new Map([
				[leaderKey("Grace Hopper"), ["Grace Hopper", "Grace Hopper"]],
				[leaderKey("Ada Lovelace"), ["Ada Lovelace"]],
				[leaderKey("Alan Turing"), ["Alan Turing"]],
			]),
		);

		expect(ambiguous).toHaveLength(1);
		expect(ambiguous[0]?.reason).toBe("multiple-matches");
		expect(ambiguous[0]?.candidates).toHaveLength(2);
	});

	it("never guesses — every unresolved name is reported", () => {
		const ambiguous = findAmbiguousLabels(resolution, new Map());
		expect(ambiguous.map((a) => a.baseName)).toEqual([
			"Grace Hopper",
			"Ada Lovelace",
			"Alan Turing",
		]);
	});
});
