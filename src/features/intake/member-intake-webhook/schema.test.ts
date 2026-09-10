import { describe, expect, it } from "vitest";
import {
	AREA_GROUP_LABELS,
	areaGroup,
	YEAR_OF_STUDY_LABELS,
	yearOfStudy,
} from "@/db/schema/members.ts";
import { memberIntakeSchema, memberIntakeWebhookSchema } from "./schema.ts";

const valid = {
	fullName: "Ada Lovelace",
	phone: "0700000000",
	email: "ada@example.com",
	gender: "female",
	residence: "Hall 3",
	fieldOfStudy: "Mathematics",
	yearOfStudy: "year_2" as const,
	areaGroup: "parktown_east" as const,
	submittedAt: "2026-09-10T12:00:00Z",
};

describe("memberIntakeWebhookSchema", () => {
	it("accepts a fully populated payload", () => {
		expect(memberIntakeWebhookSchema.safeParse(valid).success).toBe(true);
	});

	it("requires a fullName", () => {
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, fullName: "" }).success,
		).toBe(false);
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, fullName: "A" }).success,
		).toBe(false);
	});

	it("rejects a malformed email but allows a blank one", () => {
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, email: "not-an-email" })
				.success,
		).toBe(false);
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, email: "" }).success,
		).toBe(true);
	});

	it("defaults every optional field to blank when omitted", () => {
		const { fullName, areaGroup: group, submittedAt } = valid;
		const result = memberIntakeWebhookSchema.safeParse({
			fullName,
			areaGroup: group,
			submittedAt,
		});
		expect(result.success).toBe(true);
	});

	// Apps Script's `v()` helper returns `null`, not a missing key, for an
	// unanswered question — and JSON.stringify keeps null keys, unlike
	// undefined ones. Every optional field must tolerate this, not just an
	// absent key.
	it.each([
		"phone",
		"email",
		"gender",
		"residence",
		"fieldOfStudy",
		"yearOfStudy",
	])("accepts null for the optional %s field", (field) => {
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, [field]: null }).success,
		).toBe(true);
	});

	it.each(
		areaGroup.enumValues,
	)("accepts the %s area group by its slug", (group) => {
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, areaGroup: group })
				.success,
		).toBe(true);
	});

	it.each(
		areaGroup.enumValues,
	)("accepts the %s area group by its Google Forms label", (group) => {
		const result = memberIntakeWebhookSchema.safeParse({
			...valid,
			areaGroup: AREA_GROUP_LABELS[group],
		});
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.areaGroup).toBe(group);
	});

	it("matches an area group label case-insensitively", () => {
		const result = memberIntakeWebhookSchema.safeParse({
			...valid,
			areaGroup: "main (central)",
		});
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.areaGroup).toBe("main_central");
	});

	it("rejects an area group outside the fixed five", () => {
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, areaGroup: "downtown" })
				.success,
		).toBe(false);
	});

	it("requires an area group, whether omitted, blank, or null", () => {
		const { areaGroup: _omitted, ...withoutArea } = valid;
		expect(memberIntakeWebhookSchema.safeParse(withoutArea).success).toBe(
			false,
		);
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, areaGroup: "" }).success,
		).toBe(false);
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, areaGroup: null })
				.success,
		).toBe(false);
	});

	it.each(
		yearOfStudy.enumValues,
	)("accepts the %s year of study by its slug", (year) => {
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, yearOfStudy: year })
				.success,
		).toBe(true);
	});

	it.each(
		yearOfStudy.enumValues,
	)("accepts the %s year of study by its Google Forms label", (year) => {
		const result = memberIntakeWebhookSchema.safeParse({
			...valid,
			yearOfStudy: YEAR_OF_STUDY_LABELS[year],
		});
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.yearOfStudy).toBe(year);
	});

	it("accepts a blank or null year of study", () => {
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, yearOfStudy: "" })
				.success,
		).toBe(true);
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, yearOfStudy: null })
				.success,
		).toBe(true);
	});

	it("rejects a year of study outside the fixed set", () => {
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, yearOfStudy: "year_9" })
				.success,
		).toBe(false);
	});

	it("does not require a year of study", () => {
		const { yearOfStudy: _omitted, ...withoutYear } = valid;
		expect(memberIntakeWebhookSchema.safeParse(withoutYear).success).toBe(true);
	});

	it("rejects a submittedAt that is not a valid ISO datetime", () => {
		expect(
			memberIntakeWebhookSchema.safeParse({
				...valid,
				submittedAt: "not-a-date",
			}).success,
		).toBe(false);
	});
});

describe("memberIntakeSchema", () => {
	it("turns blank optional fields into null", () => {
		const parsed = memberIntakeSchema.parse({
			fullName: "Ada Lovelace",
			phone: "",
			email: "",
			gender: "",
			residence: "",
			fieldOfStudy: "",
			yearOfStudy: "",
			areaGroup: "main_central",
			submittedAt: "2026-09-10T12:00:00Z",
		});

		expect(parsed).toMatchObject({
			phone: null,
			email: null,
			gender: null,
			residence: null,
			fieldOfStudy: null,
			yearOfStudy: null,
		});
	});

	it("turns null optional fields into null, the same as blank", () => {
		const parsed = memberIntakeSchema.parse({
			fullName: "Ada Lovelace",
			phone: null,
			email: null,
			gender: null,
			residence: null,
			fieldOfStudy: null,
			yearOfStudy: null,
			areaGroup: "main_central",
			submittedAt: "2026-09-10T12:00:00Z",
		});

		expect(parsed).toMatchObject({
			phone: null,
			email: null,
			gender: null,
			residence: null,
			fieldOfStudy: null,
			yearOfStudy: null,
		});
	});

	it("resolves a Google Forms area group label to its stored slug", () => {
		const parsed = memberIntakeSchema.parse({
			...valid,
			areaGroup: "Braamfontein West",
		});
		expect(parsed.areaGroup).toBe("braamfontein_west");
	});

	it("parses submittedAt into a Date", () => {
		const parsed = memberIntakeSchema.parse(valid);
		expect(parsed.submittedAt).toBeInstanceOf(Date);
		expect(parsed.submittedAt.toISOString()).toBe("2026-09-10T12:00:00.000Z");
	});
});
