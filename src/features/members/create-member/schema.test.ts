import { describe, expect, it } from "vitest";
import { createMemberSchema } from "./schema.ts";

const LEADER_ID = "3f1c0b6e-1c3a-4a1e-9c7a-2b8d5f4e6a70";

const valid = {
	name: "Ada Lovelace",
	leaderId: LEADER_ID,
	phone: "0700000000",
	email: "ada@example.com",
	gender: "female",
	residence: "Hall 3",
	fieldOfStudy: "Mathematics",
	status: "new",
};

describe("createMemberSchema", () => {
	it("accepts a fully populated member", () => {
		expect(createMemberSchema.parse(valid).name).toBe("Ada Lovelace");
	});

	it("accepts a member with only a name and status", () => {
		// Everything else is backfilled later — the same assumption the CSV
		// import makes.
		const parsed = createMemberSchema.parse({
			name: "Ada Lovelace",
			leaderId: null,
			phone: "",
			email: "",
			gender: "",
			residence: "",
			fieldOfStudy: "",
			status: "new",
		});

		expect(parsed.leaderId).toBeNull();
		expect(parsed.phone).toBeNull();
		expect(parsed.gender).toBeNull();
	});

	it("requires a name", () => {
		expect(createMemberSchema.safeParse({ ...valid, name: "" }).success).toBe(
			false,
		);
		expect(createMemberSchema.safeParse({ ...valid, name: "A" }).success).toBe(
			false,
		);
	});

	it("trims the name", () => {
		expect(createMemberSchema.parse({ ...valid, name: "  Ada  " }).name).toBe(
			"Ada",
		);
	});

	it("allows no connect leader", () => {
		expect(
			createMemberSchema.parse({ ...valid, leaderId: null }).leaderId,
		).toBe(null);
	});

	it("rejects a leaderId that is not a uuid", () => {
		expect(
			createMemberSchema.safeParse({ ...valid, leaderId: "Grace Hopper" })
				.success,
		).toBe(false);
	});

	it("accepts a blank email but rejects a malformed one", () => {
		expect(createMemberSchema.parse({ ...valid, email: "" }).email).toBeNull();
		expect(
			createMemberSchema.safeParse({ ...valid, email: "nope" }).success,
		).toBe(false);
	});

	it.each([
		"new",
		"contacted",
		"assigned",
		"inducted",
		"inactive",
	])("accepts the %j status", (status) => {
		expect(createMemberSchema.parse({ ...valid, status }).status).toBe(status);
	});

	it("rejects an unknown status rather than silently defaulting", () => {
		// Unlike the CSV import, this comes from our own <Select> — an
		// unexpected value means something is wrong, not that a human typo'd.
		expect(
			createMemberSchema.safeParse({ ...valid, status: "whatever" }).success,
		).toBe(false);
	});

	it("turns whitespace-only optional fields into null", () => {
		expect(
			createMemberSchema.parse({ ...valid, residence: "   " }).residence,
		).toBeNull();
	});
});
