import { describe, expect, it } from "vitest";
import { areaGroup, yearOfStudy } from "@/db/schema/members.ts";
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

	it.each(areaGroup.enumValues)("accepts the %s area group", (group) => {
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, areaGroup: group })
				.success,
		).toBe(true);
	});

	it("rejects an area group outside the fixed five", () => {
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, areaGroup: "downtown" })
				.success,
		).toBe(false);
	});

	it("requires an area group", () => {
		const { areaGroup: _omitted, ...withoutArea } = valid;
		expect(memberIntakeWebhookSchema.safeParse(withoutArea).success).toBe(
			false,
		);
	});

	it.each(yearOfStudy.enumValues)("accepts the %s year of study", (year) => {
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, yearOfStudy: year })
				.success,
		).toBe(true);
	});

	it("accepts a blank year of study", () => {
		expect(
			memberIntakeWebhookSchema.safeParse({ ...valid, yearOfStudy: "" })
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

	it("parses submittedAt into a Date", () => {
		const parsed = memberIntakeSchema.parse(valid);
		expect(parsed.submittedAt).toBeInstanceOf(Date);
		expect(parsed.submittedAt.toISOString()).toBe("2026-09-10T12:00:00.000Z");
	});
});
