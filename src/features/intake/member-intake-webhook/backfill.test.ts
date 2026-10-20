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

	it("updates every field that differs, even when the existing row already has a value — a resubmission is a real correction, not just a backfill", () => {
		expect(buildIntakeBackfillPatch(fullExisting, incoming, LEADER_ID)).toEqual(
			{
				email: "ada@example.com",
				phone: "0711111111",
				gender: "male",
				residence: "Hall 5",
				fieldOfStudy: "Literature",
				yearOfStudy: "year_3",
				ministry: "hosting",
				areaGroup: "parktown_east",
				// leaderId is absent: it stays backfill-only, see below.
			},
		);
	});

	it("leaves a field out of the patch when the incoming value is identical to what's on file", () => {
		const sameAsIncoming: ExistingMemberFields = {
			...fullExisting,
			residence: "Hall 5",
			yearOfStudy: "year_3",
		};

		const patch = buildIntakeBackfillPatch(sameAsIncoming, incoming, LEADER_ID);
		expect(patch).not.toHaveProperty("residence");
		expect(patch).not.toHaveProperty("yearOfStudy");
		// Everything else still differs and is still updated.
		expect(patch).toMatchObject({ email: "ada@example.com" });
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

	it("updates yearOfStudy when it differs, same as fieldOfStudy", () => {
		const existing: ExistingMemberFields = {
			...fullExisting,
			yearOfStudy: "year_1",
		};

		expect(
			buildIntakeBackfillPatch(existing, incoming, LEADER_ID),
		).toMatchObject({ yearOfStudy: "year_3" });
	});

	it("updates ministry when it differs, same as yearOfStudy", () => {
		const existing: ExistingMemberFields = {
			...fullExisting,
			ministry: "band",
		};

		expect(
			buildIntakeBackfillPatch(existing, incoming, LEADER_ID),
		).toMatchObject({ ministry: "hosting" });
	});

	it("updates email when it differs from what's on file", () => {
		expect(
			buildIntakeBackfillPatch(
				{ ...emptyExisting, email: null },
				incoming,
				null,
			),
		).toMatchObject({ email: "ada@example.com" });

		expect(
			buildIntakeBackfillPatch(fullExisting, incoming, LEADER_ID),
		).toMatchObject({ email: "ada@example.com" });
	});

	it("never touches email when the incoming submission didn't give one", () => {
		const blankEmail: MemberIntakeValues = { ...incoming, email: null };
		expect(
			buildIntakeBackfillPatch(emptyExisting, blankEmail, null),
		).not.toHaveProperty("email");
	});

	it("does not include name — that's never part of this at all", () => {
		const patch = buildIntakeBackfillPatch(emptyExisting, incoming, LEADER_ID);
		expect(patch).not.toHaveProperty("name");
	});

	it("fills leaderId only when the existing row has none — never reassigns one that's already set", () => {
		expect(
			buildIntakeBackfillPatch(emptyExisting, incoming, LEADER_ID),
		).toMatchObject({ leaderId: LEADER_ID });

		// fullExisting already has LEADER_ID; resolving to a *different* id must
		// still never overwrite it — leader reassignment stays admin-only.
		const differentLeaderId = "22222222-2222-4222-8222-222222222222";
		expect(
			buildIntakeBackfillPatch(fullExisting, incoming, differentLeaderId),
		).not.toHaveProperty("leaderId");
	});

	it("never sets leaderId when the caller couldn't resolve one", () => {
		const patch = buildIntakeBackfillPatch(emptyExisting, incoming, null);
		expect(patch).not.toHaveProperty("leaderId");
	});
});
