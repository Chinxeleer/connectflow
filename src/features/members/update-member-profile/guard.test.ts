import { describe, expect, it } from "vitest";
import type { Actor } from "@/lib/permissions.ts";
import {
	decideProfileUpdate,
	memberProfilePermissions,
	type ProfileFieldPermissions,
} from "./guard.ts";

const admin: Actor = { id: "u-admin", role: "admin" };
const leader: Actor = { id: "u-leader", role: "leader" };

const GRACE = "11111111-1111-4111-8111-111111111111";
const ADA = "22222222-2222-4222-8222-222222222222";
const MARY = "33333333-3333-4333-8333-333333333333";
const KATHERINE = "44444444-4444-4444-8444-444444444444";

const everything: ProfileFieldPermissions = {
	canEditProfile: true,
	canEditStatus: true,
	canEditLeader: true,
};

const profileOnly: ProfileFieldPermissions = {
	canEditProfile: true,
	canEditStatus: false,
	canEditLeader: false,
};

const nothing: ProfileFieldPermissions = {
	canEditProfile: false,
	canEditStatus: false,
	canEditLeader: false,
};

describe("memberProfilePermissions", () => {
	it("gives an admin every field, even for a member in no connect of theirs", () => {
		expect(
			memberProfilePermissions({
				actor: admin,
				memberId: MARY,
				memberLeaderId: KATHERINE,
				linkedMemberIds: [],
			}),
		).toEqual(everything);
	});

	it("lets a leader edit their own profile", () => {
		expect(
			memberProfilePermissions({
				actor: leader,
				memberId: GRACE,
				memberLeaderId: null,
				linkedMemberIds: [GRACE],
			}),
		).toEqual(profileOnly);
	});

	it("refuses a leader the status and connect leader on their own profile", () => {
		const permissions = memberProfilePermissions({
			actor: leader,
			memberId: GRACE,
			memberLeaderId: null,
			linkedMemberIds: [GRACE],
		});

		expect(permissions.canEditStatus).toBe(false);
		expect(permissions.canEditLeader).toBe(false);
	});

	it("lets a leader edit a direct report's profile fields", () => {
		expect(
			memberProfilePermissions({
				actor: leader,
				memberId: ADA,
				memberLeaderId: GRACE,
				linkedMemberIds: [GRACE],
			}),
		).toEqual(profileOnly);
	});

	it("refuses a leader every field on someone further down their own tree", () => {
		// Mary reports to Katherine, who reports to Grace. Grace can see Mary on
		// the hierarchy page, but seeing is not editing.
		expect(
			memberProfilePermissions({
				actor: leader,
				memberId: MARY,
				memberLeaderId: KATHERINE,
				linkedMemberIds: [GRACE],
			}),
		).toEqual(nothing);
	});

	it("refuses a leader every field on a member outside their connect entirely", () => {
		expect(
			memberProfilePermissions({
				actor: leader,
				memberId: MARY,
				memberLeaderId: null,
				linkedMemberIds: [GRACE],
			}),
		).toEqual(nothing);
	});

	it("refuses every field to a leader with no linked member row, rather than granting all of them", () => {
		expect(
			memberProfilePermissions({
				actor: leader,
				memberId: ADA,
				memberLeaderId: GRACE,
				linkedMemberIds: [],
			}),
		).toEqual(nothing);
	});

	it("matches a direct report through any one of several linked member rows", () => {
		expect(
			memberProfilePermissions({
				actor: leader,
				memberId: MARY,
				memberLeaderId: KATHERINE,
				linkedMemberIds: [GRACE, KATHERINE],
			}),
		).toEqual(profileOnly);
	});

	it.each([
		["an unknown role", "auditor"],
		["an empty role", ""],
		["a null role", null],
		["an absent role", undefined],
	])("refuses every field to %s", (_label, role) => {
		const actor = { id: "u-x", role } as Actor;

		expect(
			memberProfilePermissions({
				actor,
				memberId: ADA,
				memberLeaderId: GRACE,
				linkedMemberIds: [GRACE],
			}),
		).toEqual(nothing);
	});

	it("does not treat a role that merely contains 'admin' as admin", () => {
		const actor = { id: "u-x", role: "not-admin" } as Actor;

		expect(
			memberProfilePermissions({
				actor,
				memberId: ADA,
				memberLeaderId: GRACE,
				linkedMemberIds: [GRACE],
			}),
		).toEqual(nothing);
	});
});

describe("decideProfileUpdate", () => {
	it("allows an unchanged submission from someone who may edit the profile", () => {
		expect(
			decideProfileUpdate({
				permissions: profileOnly,
				statusChanged: false,
				leaderChanged: false,
			}),
		).toEqual({ allowed: true });
	});

	it("refuses anyone who may not edit the profile at all", () => {
		const result = decideProfileUpdate({
			permissions: nothing,
			statusChanged: false,
			leaderChanged: false,
		});

		expect(result.allowed).toBe(false);
		if (result.allowed) return;
		expect(result.reason).toMatch(/report directly to you/i);
	});

	it("refuses a leader who changed the connect leader, rather than silently ignoring it", () => {
		// The payload carried a leaderId even though the form showed it as text.
		// Dropping it quietly would report success and move nobody.
		const result = decideProfileUpdate({
			permissions: profileOnly,
			statusChanged: false,
			leaderChanged: true,
		});

		expect(result.allowed).toBe(false);
		if (result.allowed) return;
		expect(result.reason).toMatch(/only an admin can move a member/i);
	});

	it("accepts a leader who submitted the current connect leader unchanged", () => {
		// The form round-trips it for every role, so this is the normal case.
		expect(
			decideProfileUpdate({
				permissions: profileOnly,
				statusChanged: false,
				leaderChanged: false,
			}),
		).toEqual({ allowed: true });
	});

	it("refuses a leader who changed the status", () => {
		const result = decideProfileUpdate({
			permissions: profileOnly,
			statusChanged: true,
			leaderChanged: false,
		});

		expect(result.allowed).toBe(false);
		if (result.allowed) return;
		expect(result.reason).toMatch(
			/only an admin can change a member's status/i,
		);
	});

	it("allows an admin to change the connect leader", () => {
		expect(
			decideProfileUpdate({
				permissions: everything,
				statusChanged: false,
				leaderChanged: true,
			}),
		).toEqual({ allowed: true });
	});

	it("allows an admin to change the status", () => {
		expect(
			decideProfileUpdate({
				permissions: everything,
				statusChanged: true,
				leaderChanged: false,
			}),
		).toEqual({ allowed: true });
	});

	it("allows an admin to change both at once", () => {
		expect(
			decideProfileUpdate({
				permissions: everything,
				statusChanged: true,
				leaderChanged: true,
			}),
		).toEqual({ allowed: true });
	});

	it("names the connect leader first when a leader changed both", () => {
		const result = decideProfileUpdate({
			permissions: profileOnly,
			statusChanged: true,
			leaderChanged: true,
		});

		expect(result.allowed).toBe(false);
		if (result.allowed) return;
		expect(result.reason).toMatch(/move a member/i);
	});
});
