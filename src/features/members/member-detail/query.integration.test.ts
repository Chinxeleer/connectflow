import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { selectMemberDetail } from "./query.ts";

/**
 * The profile query resolves two things the members list does not: the
 * leader's name through a self-join, and the people who report directly to
 * this member, named, through a second query keyed on `leaderId`.
 */
const TAG = `__detailtest_${Date.now()}`;
const named = (label: string) => `${TAG}_${label}`;

let graceId = "";
let adaId = "";
let loneId = "";
let createdIds: string[] = [];

describe.skipIf(!process.env.DATABASE_URL)(
	"selectMemberDetail (database)",
	{ retry: 2 },
	() => {
		beforeAll(async () => {
			const [grace, lone] = await db
				.insert(members)
				.values([{ name: named("Grace") }, { name: named("Lone") }])
				.returning({ id: members.id });
			graceId = grace?.id ?? "";
			loneId = lone?.id ?? "";

			const [ada] = await db
				.insert(members)
				.values([
					{
						name: named("Ada"),
						leaderId: graceId,
						gender: "female",
						residence: "Sunnyside",
					},
					{ name: named("Alan"), leaderId: graceId },
				])
				.returning({ id: members.id });
			adaId = ada?.id ?? "";

			const all = await db
				.select({ id: members.id })
				.from(members)
				.where(inArray(members.id, [graceId, loneId, adaId]));

			createdIds = [graceId, loneId, ...all.map((row) => row.id)];
			// Alan too — collected by leader rather than by returning order.
			const reports = await db
				.select({ id: members.id })
				.from(members)
				.where(inArray(members.leaderId, [graceId]));
			createdIds = [...new Set([...createdIds, ...reports.map((r) => r.id)])];
		});

		afterAll(async () => {
			await db
				.update(members)
				.set({ leaderId: null })
				.where(inArray(members.id, createdIds));
			await db.delete(members).where(inArray(members.id, createdIds));
		});

		it("resolves the member's connect leader by name", async () => {
			const member = await selectMemberDetail(adaId);

			expect(member?.leaderId).toBe(graceId);
			expect(member?.leaderName).toBe(named("Grace"));
		});

		it("names the members reporting directly to a leader, in name order", async () => {
			const member = await selectMemberDetail(graceId);

			expect(member?.reports.map((report) => report.name)).toEqual([
				named("Ada"),
				named("Alan"),
			]);
		});

		it("returns no reports for a member nobody reports to", async () => {
			const member = await selectMemberDetail(loneId);

			expect(member?.reports).toEqual([]);
		});

		it("leaves the leader name null for an unassigned member", async () => {
			const member = await selectMemberDetail(loneId);

			expect(member?.leaderId).toBeNull();
			expect(member?.leaderName).toBeNull();
		});

		it("returns the profile fields as stored, blanks included", async () => {
			const member = await selectMemberDetail(adaId);

			expect(member?.gender).toBe("female");
			expect(member?.residence).toBe("Sunnyside");
			expect(member?.fieldOfStudy).toBeNull();
		});

		it("reports whether the member has a sign-in account", async () => {
			const member = await selectMemberDetail(adaId);

			expect(member?.hasAccount).toBe(false);
		});

		it("returns null for a member id that does not exist", async () => {
			expect(
				await selectMemberDetail("99999999-9999-4999-8999-999999999999"),
			).toBeNull();
		});
	},
);
