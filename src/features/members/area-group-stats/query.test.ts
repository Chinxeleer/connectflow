import { describe, expect, it } from "vitest";
import { areaGroup } from "@/db/schema/members.ts";
import { fillAreaGroupStats } from "./query.ts";

describe("fillAreaGroupStats", () => {
	it("returns every area group, in enum order, when no rows came back", () => {
		expect(fillAreaGroupStats([])).toEqual(
			areaGroup.enumValues.map((group) => ({
				areaGroup: group,
				memberCount: 0,
				connectCount: 0,
			})),
		);
	});

	it("zero-fills a group that has no rows rather than dropping it", () => {
		const result = fillAreaGroupStats([
			{ areaGroup: "parktown_east", memberCount: 12, connectCount: 3 },
		]);

		expect(result).toHaveLength(areaGroup.enumValues.length);
		expect(result.find((row) => row.areaGroup === "parktown_east")).toEqual({
			areaGroup: "parktown_east",
			memberCount: 12,
			connectCount: 3,
		});
		expect(result.find((row) => row.areaGroup === "main_central")).toEqual({
			areaGroup: "main_central",
			memberCount: 0,
			connectCount: 0,
		});
	});

	it("orders rows the way the enum declares them, not the order the rows arrived in", () => {
		const result = fillAreaGroupStats([
			{ areaGroup: "braamfontein_west", memberCount: 1, connectCount: 0 },
			{ areaGroup: "main_central", memberCount: 2, connectCount: 1 },
		]);

		expect(result.map((row) => row.areaGroup)).toEqual([
			...areaGroup.enumValues,
		]);
	});
});
