import { like } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { ImportFormatError } from "./build-import.ts";
import { deleteMembersByIds, runMemberImport } from "./run-import.ts";

/**
 * Exercises the import against a real transaction. The rollback behaviour is
 * the point: it cannot be proven with pure tests, and a partial import is the
 * failure mode that would be hardest to notice afterwards.
 */
const TAG = "__importtest";

async function tagged() {
	return await db
		.select({ id: members.id, name: members.name, leaderId: members.leaderId })
		.from(members)
		.where(like(members.name, `${TAG}%`));
}

// Retried: these open real WebSocket transactions against Neon, which drops a
// connection every so often. The retry covers that transport flakiness, not
// logic — the pure tests alongside them stay strict.
describe.skipIf(!process.env.DATABASE_URL)(
	"runMemberImport (database)",
	{ retry: 2 },
	() => {
		afterEach(async () => {
			await deleteMembersByIds((await tagged()).map((row) => row.id));
		});

		it("imports rows and links them to a leader introduced by the same file", async () => {
			const result = await runMemberImport(
				[
					"Leader,Name",
					`,${TAG}_Grace`,
					`${TAG}_Grace - Group A,${TAG}_Ada`,
					`,${TAG}_Alan`,
				].join("\n"),
			);

			expect(result.status).toBe("imported");
			if (result.status !== "imported") return;

			expect(result.inserted).toBe(3);
			expect(result.linked).toBe(2);
			expect(result.unassigned).toBe(1);

			const rows = await tagged();
			const grace = rows.find((row) => row.name === `${TAG}_Grace`);
			const ada = rows.find((row) => row.name === `${TAG}_Ada`);

			expect(grace?.leaderId).toBeNull();
			expect(ada?.leaderId).toBe(grace?.id);
		});

		it("forward-fills so a blank leader cell inherits the leader above", async () => {
			await runMemberImport(
				[
					"Leader,Name",
					`,${TAG}_Grace`,
					`${TAG}_Grace,${TAG}_Ada`,
					`,${TAG}_Alan`,
				].join("\n"),
			);

			const rows = await tagged();
			const grace = rows.find((row) => row.name === `${TAG}_Grace`);

			expect(rows.find((row) => row.name === `${TAG}_Alan`)?.leaderId).toBe(
				grace?.id,
			);
		});

		it("creates a leader who has no member row, and reports it", async () => {
			// The top of the tree: named as a leader, never listed as a member.
			// A leader *is* a member, so this has one reading — create them.
			const result = await runMemberImport(
				["Leader,Name", `${TAG}_Root,${TAG}_Ada`, `,${TAG}_Alan`].join("\n"),
			);

			expect(result.status).toBe("imported");
			if (result.status !== "imported") return;

			expect(result.leadersCreated).toEqual([`${TAG}_Root`]);
			expect(result.inserted).toBe(3);
			expect(result.linked).toBe(2);

			const rows = await tagged();
			const root = rows.find((row) => row.name === `${TAG}_Root`);
			expect(root?.leaderId).toBeNull();
			expect(rows.find((row) => row.name === `${TAG}_Ada`)?.leaderId).toBe(
				root?.id,
			);
		});

		it("creates a missing leader only once, however many people they lead", async () => {
			const result = await runMemberImport(
				[
					"Leader,Name",
					`${TAG}_Root,${TAG}_Ada`,
					`,${TAG}_Alan`,
					`${TAG}_Root,${TAG}_Mary`,
				].join("\n"),
			);

			expect(result.status).toBe("imported");
			if (result.status !== "imported") return;
			expect(result.leadersCreated).toEqual([`${TAG}_Root`]);

			const roots = (await tagged()).filter(
				(row) => row.name === `${TAG}_Root`,
			);
			expect(roots).toHaveLength(1);
		});

		it("rolls back when a leader name matches two members", async () => {
			const result = await runMemberImport(
				[
					"Leader,Name",
					`,${TAG}_Twin`,
					`,${TAG}_Twin`,
					`${TAG}_Twin,${TAG}_Ada`,
				].join("\n"),
			);

			expect(result.status).toBe("needs-review");
			if (result.status !== "needs-review") return;

			expect(result.ambiguous[0]?.reason).toBe("multiple-matches");

			// The critical assertion: the insert pass must not survive the halt.
			expect(await tagged()).toEqual([]);
		});

		it("keeps rows unlinked, not rejected, when no leader column is present", async () => {
			const result = await runMemberImport(
				["Name", `${TAG}_Ada`, `${TAG}_Alan`].join("\n"),
			);

			expect(result.status).toBe("imported");
			if (result.status !== "imported") return;

			expect(result.inserted).toBe(2);
			expect(result.unassigned).toBe(2);
			expect((await tagged()).every((row) => row.leaderId === null)).toBe(true);
		});

		it("imports the good rows and reports the bad ones by line number", async () => {
			const result = await runMemberImport(
				["Name,Email", `${TAG}_Ada,ada@example.com`, "A,broken"].join("\n"),
			);

			expect(result.status).toBe("imported");
			if (result.status !== "imported") return;

			expect(result.inserted).toBe(1);
			expect(result.issues.some((issue) => issue.row === 3)).toBe(true);
		});

		it("refuses a file with no Name column without writing anything", async () => {
			await expect(runMemberImport("Leader,Phone\nGrace,0700")).rejects.toThrow(
				ImportFormatError,
			);
			expect(await tagged()).toEqual([]);
		});

		it("stores blank profile cells as null rather than empty strings", async () => {
			await runMemberImport(
				["Name,Gender,Residence", `${TAG}_Ada,,`].join("\n"),
			);

			const [row] = await db
				.select({
					gender: members.gender,
					residence: members.residence,
					fieldOfStudy: members.fieldOfStudy,
				})
				.from(members)
				.where(like(members.name, `${TAG}%`));

			expect(row?.gender).toBeNull();
			expect(row?.residence).toBeNull();
			expect(row?.fieldOfStudy).toBeNull();
		});
	},
);
