import { describe, expect, it } from "vitest";
import {
	buildIntakeBackfillPatch,
	type ExistingMemberFields,
} from "./backfill.ts";
import type { MemberIntakeValues } from "./schema.ts";

const LEADER_ID = "11111111-1111-4111-8111-111111111111";

const emptyExisting: ExistingMemberFields = {
	email: null,
	phone: null,
	gender: null,
	residence: null,
	fieldOfStudy: null,
	areaGroup: null,
	yearOfStudy: null,
	ministry: null,
	leaderId: null,
};

const fullExisting: ExistingMemberFields = {
	email: "ada.original@example.com",
	phone: "0700000000",
	gender: "female",
	residence: "Hall 3",
	fieldOfStudy: "Mathematics",
	areaGroup: "main_central",
	yearOfStudy: "year_1",
	ministry: "band",
	leaderId: LEADER_ID,
};

const incoming: MemberIntakeValues = {
	firstName: "Ada",
	surname: "Lovelace",
	phone: "0711111111",
	email: "ada@example.com",
	gender: "male",
	residence: "Hall 5",
	fieldOfStudy: "Literature",
	yearOfStudy: "year_3",
	ministry: "hosting",
	areaGroup: "parktown_east",
	connectLeaderName: "Grace Hopper",
	submittedAt: new Date("2026-09-10T12:00:00Z"),
};

describe("buildIntakeBackfillPatch", () => {
	it("fills in every field when the existing row has nothing set", () => {
		expect(
			buildIntakeBackfillPatch(emptyExisting, incoming, LEADER_ID),
		).toEqual({
			email: "ada@example.com",
			phone: "0711111111",
			gender: "male",
			residence: "Hall 5",
			fieldOfStudy: "Literature",
			yearOfStudy: "year_3",
			ministry: "hosting",
			areaGroup: "parktown_east",
			leaderId: LEADER_ID,
		});
	});

	it("changes nothing when every field is already set, even to different values", () => {
		expect(buildIntakeBackfillPatch(fullExisting, incoming, LEADER_ID)).toEqual(
			{},
		);
	});

	it("fills in only the fields that are missing, leaving the rest alone", () => {
		const existing: ExistingMemberFields = {
			...fullExisting,
			residence: null,
			areaGroup: null,
			yearOfStudy: null,
		};

		expect(buildIntakeBackfillPatch(existing, incoming, LEADER_ID)).toEqual({
			residence: "Hall 5",
			areaGroup: "parktown_east",
			yearOfStudy: "year_3",
		});
	});

	it("never touches phone/gender/residence/fieldOfStudy/yearOfStudy/ministry when the incoming value is null", () => {
		const blankIncoming: MemberIntakeValues = {
			...incoming,
			phone: null,
			gender: null,
			residence: null,
			fieldOfStudy: null,
			yearOfStudy: null,
			ministry: null,
		};

		expect(
			buildIntakeBackfillPatch(emptyExisting, blankIncoming, LEADER_ID),
		).toEqual({
			email: "ada@example.com",
			areaGroup: "parktown_east",
			leaderId: LEADER_ID,
		});
	});

	it("fills yearOfStudy only when missing, same as fieldOfStudy", () => {
		const existing: ExistingMemberFields = {
			...fullExisting,
			yearOfStudy: null,
		};

		expect(buildIntakeBackfillPatch(existing, incoming, LEADER_ID)).toEqual({
			yearOfStudy: "year_3",
		});
	});

	it("fills ministry only when missing, same as yearOfStudy", () => {
		const existing: ExistingMemberFields = {
			...fullExisting,
			ministry: null,
		};

		expect(buildIntakeBackfillPatch(existing, incoming, LEADER_ID)).toEqual({
			ministry: "hosting",
		});
	});

	it("fills email only when the member had none — never overwrites an existing one", () => {
		expect(
			buildIntakeBackfillPatch(
				{ ...emptyExisting, email: null },
				incoming,
				null,
			),
		).toMatchObject({ email: "ada@example.com" });

		expect(
			buildIntakeBackfillPatch(fullExisting, incoming, LEADER_ID),
		).not.toHaveProperty("email");
	});

	it("never touches email when the incoming submission didn't give one", () => {
		const blankEmail: MemberIntakeValues = { ...incoming, email: null };
		expect(
			buildIntakeBackfillPatch(emptyExisting, blankEmail, null),
		).not.toHaveProperty("email");
	});

	it("does not include name — that's never backfilled here", () => {
		const patch = buildIntakeBackfillPatch(emptyExisting, incoming, LEADER_ID);
		expect(patch).not.toHaveProperty("name");
	});

	it("fills leaderId only when the existing row has none", () => {
		expect(
			buildIntakeBackfillPatch(emptyExisting, incoming, LEADER_ID),
		).toMatchObject({ leaderId: LEADER_ID });

		expect(
			buildIntakeBackfillPatch(fullExisting, incoming, LEADER_ID),
		).not.toHaveProperty("leaderId");
	});

	it("never sets leaderId when the caller couldn't resolve one", () => {
		const patch = buildIntakeBackfillPatch(emptyExisting, incoming, null);
		expect(patch).not.toHaveProperty("leaderId");
	});
});
