import { describe, expect, it } from "vitest";
import {
	buildIntakeBackfillPatch,
	type ExistingMemberFields,
} from "./backfill.ts";
import type { MemberIntakeValues } from "./schema.ts";

const emptyExisting: ExistingMemberFields = {
	phone: null,
	gender: null,
	residence: null,
	fieldOfStudy: null,
	areaGroup: null,
};

const fullExisting: ExistingMemberFields = {
	phone: "0700000000",
	gender: "female",
	residence: "Hall 3",
	fieldOfStudy: "Mathematics",
	areaGroup: "main_central",
};

const incoming: MemberIntakeValues = {
	fullName: "Ada Lovelace",
	phone: "0711111111",
	email: "ada@example.com",
	gender: "male",
	residence: "Hall 5",
	fieldOfStudy: "Literature",
	areaGroup: "parktown_east",
	submittedAt: new Date("2026-09-10T12:00:00Z"),
};

describe("buildIntakeBackfillPatch", () => {
	it("fills in every field when the existing row has nothing set", () => {
		expect(buildIntakeBackfillPatch(emptyExisting, incoming)).toEqual({
			phone: "0711111111",
			gender: "male",
			residence: "Hall 5",
			fieldOfStudy: "Literature",
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
		};

		expect(buildIntakeBackfillPatch(existing, incoming)).toEqual({
			residence: "Hall 5",
			areaGroup: "parktown_east",
		});
	});

	it("never touches phone/gender/residence/fieldOfStudy when the incoming value is null", () => {
		const blankIncoming: MemberIntakeValues = {
			...incoming,
			phone: null,
			gender: null,
			residence: null,
			fieldOfStudy: null,
		};

		expect(buildIntakeBackfillPatch(emptyExisting, blankIncoming)).toEqual({
			areaGroup: "parktown_east",
		});
	});

	it("does not include name or email — those are never backfilled here", () => {
		const patch = buildIntakeBackfillPatch(emptyExisting, incoming);
		expect(patch).not.toHaveProperty("name");
		expect(patch).not.toHaveProperty("email");
	});
});
