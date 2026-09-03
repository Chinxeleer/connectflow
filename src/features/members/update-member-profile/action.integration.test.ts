import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import type { Actor } from "@/lib/permissions.ts";
import { linkedMemberIdsFor, wouldLoopTheTree } from "../scope.ts";
import { decideProfileUpdate, memberProfilePermissions } from "./guard.ts";

/**
 * Proves the write rules against a real database.
 *
 * The server function itself needs a request and a session, so these exercise
 * the decision path exactly as `action.ts` composes it — read the stored row,
 * derive what changed from it, then ask the guard — and assert that a refusal
 * leaves the row untouched. A mocked action would prove only that the mock was
 * called; what matters here is that a leader's edited payload moves nobody.
 */
const TAG = `__profiletest_${Date.now()}`;
const named = (label: string) => `${TAG}_${label}`;

const adminActor: Actor = { id: "u-profile-admin", role: "admin" };
const leaderActor: Actor = { id: "u-profile-leader", role: "leader" };

let graceId = "";
let adaId = "";
let maryId = "";
let outsiderId = "";
let createdIds: string[] = [];

/** The decision path from `action.ts`, over the stored row. */
async function attemptUpdate({
	actor,
	linkedMemberIds,
	memberId,
	status,
	leaderId,
}: {
	actor: Actor;
	linkedMemberIds: string[];
	memberId: string;
	status: "new" | "contacted" | "assigned" | "inducted" | "inactive";
	leaderId: string | null;
}) {
	const [current] = await db
		.select({
			id: members.id,
			status: members.status,
			leaderId: members.leaderId,
		})
		.from(members)
		.where(eq(members.id, memberId));

	if (!current) throw new Error("That member no longer exists.");

	return decideProfileUpdate({
		permissions: memberProfilePermissions({
			actor,
			memberId: current.id,
			memberLeaderId: current.leaderId,
			linkedMemberIds,
		}),
		statusChanged: current.status !== status,
		leaderChanged: (current.leaderId ?? null) !== leaderId,
	});
}

describe.skipIf(!process.env.DATABASE_URL)(
	"updateMemberProfile rules (database)",
	{ retry: 2 },
	() => {
		beforeAll(async () => {
			const [grace, outsider] = await db
				.insert(members)
				.values([{ name: named("Grace") }, { name: named("Outsider") }])
				.returning({ id: members.id });
			graceId = grace?.id ?? "";
			outsiderId = outsider?.id ?? "";

			const [ada] = await db
				.insert(members)
				.values([{ name: named("Ada"), leaderId: graceId }])
				.returning({ id: members.id });
			adaId = ada?.id ?? "";

			const [mary] = await db
				.insert(members)
				.values([{ name: named("Mary"), leaderId: adaId }])
				.returning({ id: members.id });
			maryId = mary?.id ?? "";

			createdIds = [graceId, adaId, maryId, outsiderId];
		});

		afterEach(async () => {
			// Restore the base shape after any test that writes.
			await db
				.update(members)
				.set({ leaderId: null, status: "new" })
				.where(inArray(members.id, [graceId, outsiderId]));
			await db
				.update(members)
				.set({ leaderId: graceId, status: "new" })
				.where(eq(members.id, adaId));
			await db
				.update(members)
				.set({ leaderId: adaId, status: "new" })
				.where(eq(members.id, maryId));
		});

		afterAll(async () => {
			await db
				.update(members)
				.set({ leaderId: null })
				.where(inArray(members.id, createdIds));
			await db.delete(members).where(inArray(members.id, createdIds));
		});

		it("refuses a leader who submitted a changed connect leader, and moves nobody", async () => {
			// The payload carries a leaderId even though the form showed it as
			// text. This is the request a leader could hand-edit.
			const decision = await attemptUpdate({
				actor: leaderActor,
				linkedMemberIds: [graceId],
				memberId: adaId,
				status: "new",
				leaderId: outsiderId,
			});

			expect(decision.allowed).toBe(false);

			const [after] = await db
				.select({ leaderId: members.leaderId })
				.from(members)
				.where(eq(members.id, adaId));

			expect(after?.leaderId).toBe(graceId);
		});

		it("refuses a leader who submitted a changed status, and leaves it alone", async () => {
			const decision = await attemptUpdate({
				actor: leaderActor,
				linkedMemberIds: [graceId],
				memberId: adaId,
				status: "inducted",
				leaderId: graceId,
			});

			expect(decision.allowed).toBe(false);

			const [after] = await db
				.select({ status: members.status })
				.from(members)
				.where(eq(members.id, adaId));

			expect(after?.status).toBe("new");
		});

		it("accepts a leader who round-tripped the current status and leader unchanged", async () => {
			const decision = await attemptUpdate({
				actor: leaderActor,
				linkedMemberIds: [graceId],
				memberId: adaId,
				status: "new",
				leaderId: graceId,
			});

			expect(decision.allowed).toBe(true);
		});

		it("refuses a leader editing someone further down their own tree", async () => {
			// Grace can see Mary on the hierarchy page; she still cannot edit her.
			const decision = await attemptUpdate({
				actor: leaderActor,
				linkedMemberIds: [graceId],
				memberId: maryId,
				status: "new",
				leaderId: adaId,
			});

			expect(decision.allowed).toBe(false);
		});

		it("lets an admin change the status and the connect leader", async () => {
			const decision = await attemptUpdate({
				actor: adminActor,
				linkedMemberIds: [],
				memberId: adaId,
				status: "inducted",
				leaderId: outsiderId,
			});

			expect(decision.allowed).toBe(true);
		});

		it("refuses a reassignment that would loop the tree back on itself", async () => {
			// Moving Grace under Mary, who is already below her.
			expect(await wouldLoopTheTree(graceId, maryId)).toBe(true);
		});

		it("allows a reassignment to an unrelated leader", async () => {
			expect(await wouldLoopTheTree(adaId, outsiderId)).toBe(false);
		});

		it("resolves no linked member rows for an account linked to none", async () => {
			expect(await linkedMemberIdsFor("u-profile-nobody")).toEqual([]);
		});
	},
);
