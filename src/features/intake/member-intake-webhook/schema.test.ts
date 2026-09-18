import { describe, expect, it } from "vitest";
import {
	AREA_GROUP_LABELS,
	areaGroup,
	MINISTRY_LABELS,
	ministry,
	YEAR_OF_STUDY_LABELS,
	yearOfStudy,
} from "@/db/schema/members.ts";
import { memberIntakeSchema, memberIntakeWebhookSchema } from "./schema.ts";

const valid = {
	firstName: "Ada",
	surname: "Lovelace",
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

	it("requires a non-empty firstName and surname", () => {
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, firstName: "" }).success,
		).toBe(false);
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, surname: "" }).success,
		).toBe(false);
	});

	// A name-less submission used to reach matchPerson and land in Needs
	// Review as an unreadable entry — min(1) after trim() lets all of these
	// through, since none of them is an empty string. The zero-width space
	// (U+200B) is built from its code point rather than a string escape —
	// biome silently normalizes that escape into the actual invisible
	// character.
	it.each([
		"-",
		"...",
		"12345",
		String.fromCharCode(0x200b),
	])('rejects "%s" as a firstName or surname — no actual letter in it', (placeholder) => {
		expect(
			memberIntakeWebhookSchema.safeParse({
				...valid,
				firstName: placeholder,
			}).success,
		).toBe(false);
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, surname: placeholder })
				.success,
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
		const { firstName, surname, areaGroup: group, submittedAt } = valid;
		const result = memberIntakeWebhookSchema.safeParse({
			firstName,
			surname,
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

	// The live form's actual option text — confirmed directly against it, not
	// guessed. Case-insensitive too, since Google Forms is user-typed text.
	it.each([
		"Central(Main)",
		"central(main)",
		"CENTRAL(MAIN)",
	])('resolves the live form\'s "%s" option to main_central', (raw) => {
		const result = memberIntakeWebhookSchema.safeParse({
			...valid,
			areaGroup: raw,
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

	// The live form's options for years 1-6 started as bare digits, then
	// changed to ordinals — both still need to resolve, since a submission
	// already in flight when the form changes still uses the old wording.
	it.each([
		["1", "year_1"],
		["2", "year_2"],
		["3", "year_3"],
		["4", "year_4"],
		["5", "year_5"],
		["6", "year_6"],
		["1st", "year_1"],
		["2nd", "year_2"],
		["3rd", "year_3"],
		["4th", "year_4"],
		["5th", "year_5"],
		["6th", "year_6"],
	] as const)('resolves the live form\'s "%s" option to %s', (raw, expected) => {
		const result = memberIntakeWebhookSchema.safeParse({
			...valid,
			yearOfStudy: raw,
		});
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.yearOfStudy).toBe(expected);
	});

	// The live form added two options beyond an actual year of study —
	// confirmed directly against it. Both match their label
	// case-insensitively, so they need no alias entry, just to exist in the
	// enum at all.
	it.each([
		["PostGrad", "postgrad"],
		["Alumni", "alumni"],
		["Ministry", "in_ministry"],
	] as const)('resolves the live form\'s "%s" option to %s', (raw, expected) => {
		const result = memberIntakeWebhookSchema.safeParse({
			...valid,
			yearOfStudy: raw,
		});
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.yearOfStudy).toBe(expected);
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

	it.each(
		ministry.enumValues,
	)("accepts the %s ministry by its slug", (option) => {
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, ministry: option })
				.success,
		).toBe(true);
	});

	it.each(
		ministry.enumValues,
	)("accepts the %s ministry by its Google Forms label", (option) => {
		const result = memberIntakeWebhookSchema.safeParse({
			...valid,
			ministry: MINISTRY_LABELS[option],
		});
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.ministry).toBe(option);
	});

	// The live form's fifth option — confirmed directly against it — means
	// "no ministry yet", the same as leaving the question blank.
	it('resolves the live form\'s "Not yet allocated" option to no ministry', () => {
		const result = memberIntakeWebhookSchema.safeParse({
			...valid,
			ministry: "Not yet allocated",
		});
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.ministry).toBeNull();
	});

	it("accepts a blank or null ministry", () => {
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, ministry: "" }).success,
		).toBe(true);
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, ministry: null }).success,
		).toBe(true);
	});

	it("rejects a ministry outside the fixed set", () => {
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, ministry: "Catering" })
				.success,
		).toBe(false);
	});

	it("does not require a ministry — valid has no ministry key at all", () => {
		expect(memberIntakeWebhookSchema.safeParse(valid).success).toBe(true);
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
			firstName: "Ada",
			surname: "Lovelace",
			phone: "",
			email: "",
			gender: "",
			residence: "",
			fieldOfStudy: "",
			yearOfStudy: "",
			ministry: "",
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
			ministry: null,
		});
	});

	it("turns null optional fields into null, the same as blank", () => {
		const parsed = memberIntakeSchema.parse({
			firstName: "Ada",
			surname: "Lovelace",
			phone: null,
			email: null,
			gender: null,
			residence: null,
			fieldOfStudy: null,
			yearOfStudy: null,
			ministry: null,
			areaGroup: "main_central",
			submittedAt: "2026-09-10T12:00:00Z",
		});

		expect(parsed).toMatchObject({
			phone: null,
			email: null,
			gender: null,
			residence: null,
			fieldOfStudy: null,
			ministry: null,
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
