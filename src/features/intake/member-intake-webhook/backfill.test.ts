import { describe, expect, it } from "vitest";
import {
	buildIntakeBackfillPatch,
	type ExistingMemberFields,
} from "./backfill.ts";
import type { MemberIntakeValues } from "./schema.ts";

const emptyExisting: ExistingMemberFields = {
	email: null,
	phone: null,
	gender: null,
	residence: null,
	fieldOfStudy: null,
	areaGroup: null,
	yearOfStudy: null,
};

const fullExisting: ExistingMemberFields = {
	email: "ada.original@example.com",
	phone: "0700000000",
	gender: "female",
	residence: "Hall 3",
	fieldOfStudy: "Mathematics",
	areaGroup: "main_central",
	yearOfStudy: "year_1",
};

const incoming: MemberIntakeValues = {
	fullName: "Ada Lovelace",
	phone: "0711111111",
	email: "ada@example.com",
	gender: "male",
	residence: "Hall 5",
	fieldOfStudy: "Literature",
	yearOfStudy: "year_3",
	areaGroup: "parktown_east",
	submittedAt: new Date("2026-09-10T12:00:00Z"),
};

describe("buildIntakeBackfillPatch", () => {
	it("fills in every field when the existing row has nothing set", () => {
		expect(buildIntakeBackfillPatch(emptyExisting, incoming)).toEqual({
			email: "ada@example.com",
			phone: "0711111111",
			gender: "male",
			residence: "Hall 5",
			fieldOfStudy: "Literature",
			yearOfStudy: "year_3",
			areaGroup: "parktown_east",
		});
	});

	it("changes nothing when every field is already set, even to different values", () => {
		expect(buildIntakeBackfillPatch(fullExisting, incoming)).toEqual({});
	});

	it("fills in only the fields that are missing, leaving the rest alone", () => {
		const existing: ExistingMemberFields = {
			...fullExisting,
			residence: null,
			areaGroup: null,
			yearOfStudy: null,
		};

		expect(buildIntakeBackfillPatch(existing, incoming)).toEqual({
			residence: "Hall 5",
			areaGroup: "parktown_east",
			yearOfStudy: "year_3",
		});
	});

	it("never touches phone/gender/residence/fieldOfStudy/yearOfStudy when the incoming value is null", () => {
		const blankIncoming: MemberIntakeValues = {
			...incoming,
			phone: null,
			gender: null,
			residence: null,
			fieldOfStudy: null,
			yearOfStudy: null,
		};

		expect(buildIntakeBackfillPatch(emptyExisting, blankIncoming)).toEqual({
			email: "ada@example.com",
			areaGroup: "parktown_east",
		});
	});

	it("fills yearOfStudy only when missing, same as fieldOfStudy", () => {
		const existing: ExistingMemberFields = {
			...fullExisting,
			yearOfStudy: null,
		};

		expect(buildIntakeBackfillPatch(existing, incoming)).toEqual({
			yearOfStudy: "year_3",
		});
	});

	it("fills email only when the member had none — never overwrites an existing one", () => {
		expect(
			buildIntakeBackfillPatch({ ...emptyExisting, email: null }, incoming),
		).toMatchObject({ email: "ada@example.com" });

		expect(buildIntakeBackfillPatch(fullExisting, incoming)).not.toHaveProperty(
			"email",
		);
	});

	it("never touches email when the incoming submission didn't give one", () => {
		const blankEmail: MemberIntakeValues = { ...incoming, email: null };
		expect(
			buildIntakeBackfillPatch(emptyExisting, blankEmail),
		).not.toHaveProperty("email");
	});

	it("does not include name — that's never backfilled here", () => {
		const patch = buildIntakeBackfillPatch(emptyExisting, incoming);
		expect(patch).not.toHaveProperty("name");
	});
});
