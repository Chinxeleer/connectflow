import { describe, expect, it } from "vitest";
import { areaGroup, memberStatus, yearOfStudy } from "@/db/schema/members.ts";
import {
	updateMemberProfileInputSchema,
	updateMemberProfileSchema,
} from "./schema.ts";

const MEMBER = "11111111-1111-4111-8111-111111111111";
const LEADER = "22222222-2222-4222-8222-222222222222";

const valid = {
	memberId: MEMBER,
	name: "Ada Lovelace",
	leaderId: LEADER,
	phone: "0700000000",
	email: "ada@example.com",
	gender: "female",
	residence: "Sunnyside",
	fieldOfStudy: "Computer Science",
	areaGroup: "parktown_east" as const,
	yearOfStudy: "year_2" as const,
	status: "assigned" as const,
};

describe("updateMemberProfileSchema", () => {
	it("accepts a fully populated profile", () => {
		expect(updateMemberProfileSchema.parse(valid)).toMatchObject({
			memberId: MEMBER,
			name: "Ada Lovelace",
			leaderId: LEADER,
		});
	});

	it("turns blank optional fields into null rather than empty strings", () => {
		const parsed = updateMemberProfileSchema.parse({
			...valid,
			phone: "",
			email: "",
			gender: "",
			residence: "",
			fieldOfStudy: "",
		});

		expect(parsed).toMatchObject({
			phone: null,
			email: null,
			gender: null,
			residence: null,
			fieldOfStudy: null,
		});
	});

	it("keeps the input type aligned with the form's defaults for an unfilled profile", () => {
		// The form seeds null columns as "", so an all-blank payload is normal.
		expect(
			updateMemberProfileSchema.safeParse({
				...valid,
				leaderId: null,
				phone: "",
				email: "",
				gender: "",
				residence: "",
				fieldOfStudy: "",
			}).success,
		).toBe(true);
	});

	it("trims the name", () => {
		expect(
			updateMemberProfileSchema.parse({ ...valid, name: "  Ada  " }).name,
		).toBe("Ada");
	});

	it("rejects a whitespace-only name", () => {
		expect(
			updateMemberProfileSchema.safeParse({ ...valid, name: "   " }).success,
		).toBe(false);
	});

	it("rejects a name shorter than two characters", () => {
		expect(
			updateMemberProfileSchema.safeParse({ ...valid, name: "A" }).success,
		).toBe(false);
	});

	it("requires a member id", () => {
		const { memberId: _omitted, ...withoutId } = valid;

		expect(updateMemberProfileSchema.safeParse(withoutId).success).toBe(false);
	});

	it("rejects a member id that is not a uuid", () => {
		expect(
			updateMemberProfileSchema.safeParse({ ...valid, memberId: "nope" })
				.success,
		).toBe(false);
	});

	it("allows clearing the connect leader", () => {
		expect(
			updateMemberProfileSchema.parse({ ...valid, leaderId: null }).leaderId,
		).toBeNull();
	});

	it("rejects a leaderId that is not a uuid", () => {
		expect(
			updateMemberProfileSchema.safeParse({ ...valid, leaderId: "nope" })
				.success,
		).toBe(false);
	});

	it("rejects a member who would be their own connect leader", () => {
		const result = updateMemberProfileSchema.safeParse({
			...valid,
			leaderId: MEMBER,
		});

		expect(result.success).toBe(false);
	});

	it("accepts a blank email but rejects a malformed one", () => {
		expect(
			updateMemberProfileSchema.safeParse({ ...valid, email: "" }).success,
		).toBe(true);
		expect(
			updateMemberProfileSchema.safeParse({ ...valid, email: "ada@" }).success,
		).toBe(false);
	});

	it.each(areaGroup.enumValues)("accepts the %s area group", (group) => {
		expect(
			updateMemberProfileSchema.safeParse({ ...valid, areaGroup: group })
				.success,
		).toBe(true);
	});

	it("accepts a null area group as not yet set", () => {
		expect(
			updateMemberProfileSchema.safeParse({ ...valid, areaGroup: null })
				.success,
		).toBe(true);
	});

	it("rejects an unknown area group rather than silently defaulting", () => {
		expect(
			updateMemberProfileSchema.safeParse({
				...valid,
				areaGroup: "somewhere_else",
			}).success,
		).toBe(false);
	});

	it.each(yearOfStudy.enumValues)("accepts the %s year of study", (year) => {
		expect(
			updateMemberProfileSchema.safeParse({ ...valid, yearOfStudy: year })
				.success,
		).toBe(true);
	});

	it("accepts a null year of study as not yet set", () => {
		expect(
			updateMemberProfileSchema.safeParse({ ...valid, yearOfStudy: null })
				.success,
		).toBe(true);
	});

	it("rejects an unknown year of study rather than silently defaulting", () => {
		expect(
			updateMemberProfileSchema.safeParse({
				...valid,
				yearOfStudy: "year_7",
			}).success,
		).toBe(false);
	});

	it.each(memberStatus.enumValues)("accepts the %s status", (status) => {
		expect(
			updateMemberProfileSchema.safeParse({ ...valid, status }).success,
		).toBe(true);
	});

	it("rejects an unknown status rather than silently defaulting", () => {
		// Unlike the CSV import, this comes from our own <Select> — an
		// unexpected value means something is wrong, not that a human typo'd.
		expect(
			updateMemberProfileSchema.safeParse({ ...valid, status: "whatever" })
				.success,
		).toBe(false);
	});

	it("validates the same shape before the transform, for the form", () => {
		expect(updateMemberProfileInputSchema.safeParse(valid).success).toBe(true);
	});
});
