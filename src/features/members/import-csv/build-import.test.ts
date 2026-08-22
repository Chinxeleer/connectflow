import { describe, expect, it } from "vitest";
import {
	ImportFormatError,
	type LeaderCandidate,
	parseImport,
	planLeaderLinks,
} from "./build-import.ts";
import { leaderKey } from "./csv-mapping.ts";

const HEADER = "Leader,Name,Phone,Email,Gender,Residence,Field of Study,Status";

describe("parseImport", () => {
	it("parses a sheet and forward-fills the leader column", () => {
		const { rows, leaderLabels, issues } = parseImport(
			[
				HEADER,
				"Grace Hopper - Group A,Ada Lovelace,0700,ada@example.com,female,Hall 3,Maths,new",
				",Alan Turing,0701,alan@example.com,male,Hall 1,CS,new",
				"Katherine Johnson,Mary Jackson,,,,,,",
			].join("\n"),
		);

		expect(issues).toEqual([]);
		expect(rows.map((r) => r.name)).toEqual([
			"Ada Lovelace",
			"Alan Turing",
			"Mary Jackson",
		]);
		expect(leaderLabels).toEqual([
			"Grace Hopper - Group A",
			"Grace Hopper - Group A",
			"Katherine Johnson",
		]);
	});

	it("reads the real connect-database export's headers", () => {
		// Exactly the header row of the sheet this import was built for.
		// Names are fictional; only the header row is real.
		const { rows, leaderLabels, issues } = parseImport(
			[
				"Name and Surname Of Leader,Connect Members ",
				"Pastor Ada Lovelace,Grace Hopper",
				",Alan Turing",
				"Grace Hopper,Katherine Johnson",
			].join("\r\n"),
		);

		expect(issues).toEqual([]);
		expect(rows.map((row) => row.name)).toEqual([
			"Grace Hopper",
			"Alan Turing",
			"Katherine Johnson",
		]);
		expect(leaderLabels).toEqual([
			"Pastor Ada Lovelace",
			"Pastor Ada Lovelace",
			"Grace Hopper",
		]);
	});

	it("binds 'Connect Members' to the member column, not the leader column", () => {
		// "connect" is also a leader alias; the member column must win.
		const { rows, leaderLabels } = parseImport(
			["Connect Members,Name and Surname Of Leader", "Ada,Grace"].join("\n"),
		);

		expect(rows[0]?.name).toBe("Ada");
		expect(leaderLabels).toEqual(["Grace"]);
	});

	it("names the columns it did find when there is no member-name column", () => {
		expect(() => parseImport("Date Updated,Notes\n01/01/2026,hello")).toThrow(
			/Date Updated.*Notes/s,
		);
	});

	it("accepts alternative header spellings", () => {
		const { rows, leaderLabels } = parseImport(
			[
				"Connect Leader,Full Name,Course",
				"Grace Hopper,Ada Lovelace,Maths",
			].join("\n"),
		);

		expect(rows[0]?.name).toBe("Ada Lovelace");
		expect(rows[0]?.fieldOfStudy).toBe("Maths");
		expect(leaderLabels).toEqual(["Grace Hopper"]);
	});

	it("handles quoted fields containing commas", () => {
		const { rows } = parseImport(
			["Name,Residence", '"Lovelace, Ada","Hall 3, Room 5"'].join("\n"),
		);

		expect(rows[0]?.name).toBe("Lovelace, Ada");
		expect(rows[0]?.residence).toBe("Hall 3, Room 5");
	});

	it("handles CRLF line endings and a UTF-8 BOM", () => {
		const { rows } = parseImport("﻿Name,Residence\r\nAda Lovelace,Hall 3\r\n");
		expect(rows).toHaveLength(1);
		expect(rows[0]?.name).toBe("Ada Lovelace");
	});

	it("skips entirely blank spacer rows", () => {
		const { rows, issues } = parseImport(
			["Name", "Ada Lovelace", "   ", "", "Alan Turing"].join("\n"),
		);

		expect(rows).toHaveLength(2);
		expect(issues).toEqual([]);
	});

	it("reports a bad row by spreadsheet line number without failing the batch", () => {
		const { rows, issues } = parseImport(
			["Name,Email", "Ada Lovelace,ada@example.com", "A,bad-email"].join("\n"),
		);

		expect(rows).toHaveLength(1);
		expect(issues.every((issue) => issue.row === 3)).toBe(true);
		expect(issues.length).toBeGreaterThan(0);
	});

	it("refuses a file with no Name column", () => {
		expect(() => parseImport("Leader,Phone\nGrace,0700")).toThrow(
			ImportFormatError,
		);
	});

	it("refuses a header-only file", () => {
		expect(() => parseImport(HEADER)).toThrow(ImportFormatError);
	});

	it("refuses an empty file", () => {
		expect(() => parseImport("   ")).toThrow(ImportFormatError);
	});

	it("leaves rows above the first leader value unassigned", () => {
		const { leaderLabels } = parseImport(
			["Leader,Name", ",Ada Lovelace", "Grace Hopper,Alan Turing"].join("\n"),
		);

		expect(leaderLabels).toEqual([null, "Grace Hopper"]);
	});
});

describe("planLeaderLinks", () => {
	const candidates = (
		entries: Array<[string, LeaderCandidate[]]>,
	): Map<string, LeaderCandidate[]> =>
		new Map(entries.map(([name, list]) => [leaderKey(name), list]));

	it("links every member to the one matching leader", () => {
		const plan = planLeaderLinks({
			insertedIds: ["m1", "m2"],
			leaderLabels: ["Grace Hopper - Group A", "Grace Hopper - Group B"],
			candidatesByKey: candidates([
				["Grace Hopper", [{ id: "leader-1", name: "Grace Hopper" }]],
			]),
		});

		expect(plan.ambiguous).toEqual([]);
		expect(plan.links).toEqual([
			{ memberId: "m1", leaderId: "leader-1" },
			{ memberId: "m2", leaderId: "leader-1" },
		]);
	});

	it("halts with no links when a leader name matches nothing", () => {
		const plan = planLeaderLinks({
			insertedIds: ["m1"],
			leaderLabels: ["Grace Hopper - Group A"],
			candidatesByKey: candidates([]),
		});

		expect(plan.links).toEqual([]);
		expect(plan.ambiguous).toHaveLength(1);
		expect(plan.ambiguous[0]).toMatchObject({
			baseName: "Grace Hopper",
			reason: "no-match",
			labels: ["Grace Hopper - Group A"],
		});
	});

	it("halts and surfaces candidate names when a name matches two members", () => {
		const plan = planLeaderLinks({
			insertedIds: ["m1"],
			leaderLabels: ["Grace Hopper"],
			candidatesByKey: candidates([
				[
					"Grace Hopper",
					[
						{ id: "leader-1", name: "Grace Hopper" },
						{ id: "leader-2", name: "Grace Hopper" },
					],
				],
			]),
		});

		expect(plan.links).toEqual([]);
		expect(plan.ambiguous[0]?.reason).toBe("multiple-matches");
		expect(plan.ambiguous[0]?.candidates).toEqual([
			"Grace Hopper",
			"Grace Hopper",
		]);
	});

	it("writes no links at all when any single label is ambiguous", () => {
		// All-or-nothing: a partially linked import is worse than none, because
		// the half that linked looks correct.
		const plan = planLeaderLinks({
			insertedIds: ["m1", "m2"],
			leaderLabels: ["Grace Hopper", "Nobody At All"],
			candidatesByKey: candidates([
				["Grace Hopper", [{ id: "leader-1", name: "Grace Hopper" }]],
			]),
		});

		expect(plan.links).toEqual([]);
		expect(plan.ambiguous).toHaveLength(1);
	});

	it("skips rows with no leader label", () => {
		const plan = planLeaderLinks({
			insertedIds: ["m1", "m2"],
			leaderLabels: [null, "Grace Hopper"],
			candidatesByKey: candidates([
				["Grace Hopper", [{ id: "leader-1", name: "Grace Hopper" }]],
			]),
		});

		expect(plan.links).toEqual([{ memberId: "m2", leaderId: "leader-1" }]);
	});

	it("never links a member to themselves", () => {
		const plan = planLeaderLinks({
			insertedIds: ["leader-1"],
			leaderLabels: ["Grace Hopper"],
			candidatesByKey: candidates([
				["Grace Hopper", [{ id: "leader-1", name: "Grace Hopper" }]],
			]),
		});

		expect(plan.links).toEqual([]);
		expect(plan.ambiguous).toEqual([]);
	});
});
