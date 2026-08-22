import { describe, expect, it } from "vitest";
import { importCsvSchema, memberImportRowSchema } from "./schema.ts";

const validRow = {
	name: "Ada Lovelace",
	leaderLabel: "Grace Hopper - Group A",
	phone: "0700000000",
	email: "ada@example.com",
	gender: "female",
	residence: "Hall 3",
	fieldOfStudy: "Mathematics",
	status: "new",
};

describe("memberImportRowSchema", () => {
	it("accepts a fully populated row", () => {
		const parsed = memberImportRowSchema.parse(validRow);
		expect(parsed.name).toBe("Ada Lovelace");
		expect(parsed.status).toBe("new");
	});

	it("requires a name", () => {
		const result = memberImportRowSchema.safeParse({ ...validRow, name: "" });
		expect(result.success).toBe(false);
	});

	it("rejects a one-character name", () => {
		expect(
			memberImportRowSchema.safeParse({ ...validRow, name: "A" }).success,
		).toBe(false);
	});

	it("trims the name", () => {
		expect(
			memberImportRowSchema.parse({ ...validRow, name: "  Ada Lovelace  " })
				.name,
		).toBe("Ada Lovelace");
	});

	it("turns blank optional cells into null rather than empty strings", () => {
		const parsed = memberImportRowSchema.parse({
			...validRow,
			leaderLabel: "",
			phone: "   ",
			email: "",
			gender: "",
			residence: "",
			fieldOfStudy: "",
		});

		expect(parsed.leaderLabel).toBeNull();
		expect(parsed.phone).toBeNull();
		expect(parsed.email).toBeNull();
		expect(parsed.gender).toBeNull();
		expect(parsed.residence).toBeNull();
		expect(parsed.fieldOfStudy).toBeNull();
	});

	it("accepts a blank email but rejects a malformed one", () => {
		expect(
			memberImportRowSchema.safeParse({ ...validRow, email: "" }).success,
		).toBe(true);
		expect(
			memberImportRowSchema.safeParse({ ...validRow, email: "not-an-email" })
				.success,
		).toBe(false);
	});

	it("keeps the raw leader label intact for later reporting", () => {
		// Stripping is csv-mapping's job; the schema must not pre-empt it, or an
		// ambiguity gets reported using words that are not in the file.
		expect(memberImportRowSchema.parse(validRow).leaderLabel).toBe(
			"Grace Hopper - Group A",
		);
	});

	it.each([
		"new",
		"contacted",
		"assigned",
		"inducted",
		"inactive",
	])("accepts the %j status", (status) => {
		expect(memberImportRowSchema.parse({ ...validRow, status }).status).toBe(
			status,
		);
	});

	it("accepts a status in any casing", () => {
		expect(
			memberImportRowSchema.parse({ ...validRow, status: "INDUCTED" }).status,
		).toBe("inducted");
	});

	it("falls back to 'new' for an unknown status rather than failing the row", () => {
		expect(
			memberImportRowSchema.parse({ ...validRow, status: "whatever" }).status,
		).toBe("new");
		expect(
			memberImportRowSchema.parse({ ...validRow, status: "" }).status,
		).toBe("new");
	});

	it("rejects an absurdly long name", () => {
		expect(
			memberImportRowSchema.safeParse({ ...validRow, name: "a".repeat(201) })
				.success,
		).toBe(false);
	});
});

describe("importCsvSchema", () => {
	it("accepts a named, non-empty file", () => {
		expect(
			importCsvSchema.safeParse({ fileName: "members.csv", csv: "Name\nAda" })
				.success,
		).toBe(true);
	});

	it("rejects an empty file", () => {
		expect(
			importCsvSchema.safeParse({ fileName: "members.csv", csv: "" }).success,
		).toBe(false);
	});

	it("rejects a file over 2MB", () => {
		expect(
			importCsvSchema.safeParse({
				fileName: "members.csv",
				csv: "a".repeat(2_000_001),
			}).success,
		).toBe(false);
	});
});
