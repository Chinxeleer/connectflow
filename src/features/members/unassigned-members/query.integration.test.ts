import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { selectUnassignedMembers } from "./query.ts";

/**
 * Proves the "Without a Connect" filter against a real database — the list
 * `AssignLeaderButton` acts on. A member leaves this list the same way
 * assigning a leader does: `leaderId` stops being null, which is exactly
 * what `updateMemberProfile` (the action the button reuses) writes.
 */
const TAG = `__unassignedtest_${Date.now()}`;
const named = (label: string) => `${TAG} ${label}`;

let leaderId = "";
let unassignedId = "";
let assignedId = "";
let removedId = "";
let createdIds: string[] = [];

describe.skipIf(!process.env.DATABASE_URL)(
	"selectUnassignedMembers (database)",
	{ retry: 2 },
	() => {
		beforeAll(async () => {
			const [leader, unassigned, removed] = await db
				.insert(members)
				.values([
					{ name: named("Leader") },
					{ name: named("Unassigned") },
					{ name: named("Removed"), removedAt: new Date() },
				])
				.returning({ id: members.id });
			leaderId = leader?.id ?? "";
			unassignedId = unassigned?.id ?? "";
			removedId = removed?.id ?? "";

			const [assigned] = await db
				.insert(members)
				.values({ name: named("Assigned"), leaderId })
				.returning({ id: members.id });
			assignedId = assigned?.id ?? "";

			createdIds = [leaderId, unassignedId, removedId, assignedId];
		});

		afterAll(async () => {
			await db
				.update(members)
				.set({ leaderId: null })
				.where(inArray(members.id, createdIds));
			await db.delete(members).where(inArray(members.id, createdIds));
		});

		it("includes a member with no leader and excludes one who has one", async () => {
			const rows = await selectUnassignedMembers();
			const ids = rows.map((row) => row.id);
			expect(ids).toContain(unassignedId);
			expect(ids).not.toContain(assignedId);
		});

		it("excludes a removed member even though they have no leader", async () => {
			const rows = await selectUnassignedMembers();
			expect(rows.map((row) => row.id)).not.toContain(removedId);
		});

		it("leaves the list once a leader is assigned — the effect `AssignLeaderButton` relies on", async () => {
			await db
				.update(members)
				.set({ leaderId })
				.where(eq(members.id, unassignedId));

			const rows = await selectUnassignedMembers();
			expect(rows.map((row) => row.id)).not.toContain(unassignedId);

			// restore for any later test in this suite
			await db
				.update(members)
				.set({ leaderId: null })
				.where(eq(members.id, unassignedId));
		});
	},
);
