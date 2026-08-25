import { describe, expect, it } from "vitest";
import type { Actor } from "@/lib/permissions.ts";
import { resolveNewMemberLeader } from "./guard.ts";

const admin: Actor = { id: "u-admin", role: "admin" };
const leader: Actor = { id: "u-leader", role: "leader" };

const OTHER = "11111111-1111-1111-1111-111111111111";
const OWN = "22222222-2222-2222-2222-222222222222";

describe("resolveNewMemberLeader", () => {
	it("lets an admin assign any leader", () => {
		expect(
			resolveNewMemberLeader({
				actor: admin,
				requestedLeaderId: OTHER,
				linkedMemberIds: [],
			}),
		).toEqual({ allowed: true, leaderId: OTHER });
	});

	it("lets an admin leave a member unassigned", () => {
		expect(
			resolveNewMemberLeader({
				actor: admin,
				requestedLeaderId: null,
				linkedMemberIds: [],
			}),
		).toEqual({ allowed: true, leaderId: null });
	});

	it("forces a leader's new member onto their own connect", () => {
		// The rule that matters: the requested leader is discarded, so editing
		// the payload cannot attach someone to another leader's group.
		expect(
			resolveNewMemberLeader({
				actor: leader,
				requestedLeaderId: OTHER,
				linkedMemberIds: [OWN],
			}),
		).toEqual({ allowed: true, leaderId: OWN });
	});

	it("ignores a leader asking for no leader at all", () => {
		expect(
			resolveNewMemberLeader({
				actor: leader,
				requestedLeaderId: null,
				linkedMemberIds: [OWN],
			}),
		).toEqual({ allowed: true, leaderId: OWN });
	});

	it("refuses a leader whose account has no member row", () => {
		const result = resolveNewMemberLeader({
			actor: leader,
			requestedLeaderId: null,
			linkedMemberIds: [],
		});

		expect(result.allowed).toBe(false);
		if (result.allowed) return;
		expect(result.reason).toMatch(/not linked to a member record/i);
	});

	it.each([
		["an unknown role", "auditor"],
		["an empty role", ""],
		["a null role", null],
		["an absent role", undefined],
	])("refuses %s", (_label, role) => {
		const actor = { id: "u-x", role } as Actor;
		expect(
			resolveNewMemberLeader({
				actor,
				requestedLeaderId: OTHER,
				linkedMemberIds: [OWN],
			}).allowed,
		).toBe(false);
	});

	it("never returns a leader a non-admin did not already lead", () => {
		const result = resolveNewMemberLeader({
			actor: leader,
			requestedLeaderId: OTHER,
			linkedMemberIds: [OWN],
		});

		expect(result.allowed && result.leaderId).not.toBe(OTHER);
	});
});
