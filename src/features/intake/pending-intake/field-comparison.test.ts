import { describe, expect, it } from "vitest";
import {
	compareIntakeFields,
	isApplyAllEligible,
	type PersonFields,
} from "./field-comparison.ts";

const empty: PersonFields = {
	phone: null,
	email: null,
	gender: null,
	residence: null,
	fieldOfStudy: null,
	areaGroup: null,
	yearOfStudy: null,
};

const full: PersonFields = {
	phone: "0700000000",
	email: "ada@example.com",
	gender: "female",
	residence: "Hall 3",
	fieldOfStudy: "Mathematics",
	areaGroup: "main_central",
	yearOfStudy: "year_1",
};

describe("compareIntakeFields", () => {
	it("lists every field as will_add when the existing profile is empty", () => {
		const result = compareIntakeFields(empty, full);
		expect(result).toHaveLength(7);
		expect(result.every((c) => c.status === "will_add")).toBe(true);
	});

	it("returns nothing when the incoming submission matches the existing profile exactly", () => {
		expect(compareIntakeFields(full, full)).toEqual([]);
	});

	it("returns nothing when the incoming submission offers nulls for everything", () => {
		expect(compareIntakeFields(full, empty)).toEqual([]);
	});

	it("flags a differing, already-set field as a conflict", () => {
		const incoming: PersonFields = { ...empty, gender: "male" };
		const result = compareIntakeFields(full, incoming);
		expect(result).toEqual([
			{
				field: "gender",
				existingValue: "female",
				incomingValue: "male",
				status: "conflict",
			},
		]);
	});

	it("mixes will_add and conflict fields in one comparison", () => {
		const existing: PersonFields = { ...full, phone: null };
		const incoming: PersonFields = {
			...empty,
			phone: "0711111111",
			gender: "male",
		};
		const result = compareIntakeFields(existing, incoming);
		expect(result).toEqual([
			{
				field: "phone",
				existingValue: null,
				incomingValue: "0711111111",
				status: "will_add",
			},
			{
				field: "gender",
				existingValue: "female",
				incomingValue: "male",
				status: "conflict",
			},
		]);
	});

	it("skips a field whose incoming value is null even if the existing one is set", () => {
		const incoming: PersonFields = { ...empty, phone: "0711111111" };
		const result = compareIntakeFields(full, incoming);
		expect(result).toEqual([
			{
				field: "phone",
				existingValue: "0700000000",
				incomingValue: "0711111111",
				status: "conflict",
			},
		]);
	});
});

describe("isApplyAllEligible", () => {
	it("is false for an empty comparison list — nothing to apply", () => {
		expect(isApplyAllEligible([])).toBe(false);
	});

	it("is true when every comparison is will_add", () => {
		const comparisons = compareIntakeFields(empty, full);
		expect(isApplyAllEligible(comparisons)).toBe(true);
	});

	it("is false when at least one comparison is a conflict", () => {
		const existing: PersonFields = { ...full, phone: null };
		const incoming: PersonFields = {
			...empty,
			phone: "0711111111",
			gender: "male",
		};
		const comparisons = compareIntakeFields(existing, incoming);
		expect(isApplyAllEligible(comparisons)).toBe(false);
	});
});
