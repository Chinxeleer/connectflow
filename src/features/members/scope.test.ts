import { describe, expect, it } from "vitest";
import type { Actor } from "@/lib/permissions.ts";
import { memberScopeFor } from "./scope.ts";

const admin: Actor = { id: "user-admin", role: "admin" };
const leader: Actor = { id: "user-leader", role: "leader" };

describe("memberScopeFor", () => {
	it("gives an admin the whole table", () => {
		expect(memberScopeFor(admin, [])).toEqual({ kind: "all" });
	});

	it("ignores an admin's own linked member rows — they still see everything", () => {
		expect(memberScopeFor(admin, ["member-1"])).toEqual({ kind: "all" });
	});

	it("scopes a leader to the members they lead", () => {
		expect(memberScopeFor(leader, ["member-1"])).toEqual({
			kind: "leaderOf",
			memberIds: ["member-1"],
		});
	});

	it("scopes a leader linked to several member rows to all of them", () => {
		expect(memberScopeFor(leader, ["member-1", "member-2"])).toEqual({
			kind: "leaderOf",
			memberIds: ["member-1", "member-2"],
		});
	});

	it("gives a leader with no linked member row an empty scope, not everything", () => {
		// The dangerous failure: falling through to `all` here would show one
		// leader the entire membership.
		expect(memberScopeFor(leader, [])).toEqual({
			kind: "leaderOf",
			memberIds: [],
		});
	});

	it.each([
		["an unknown role", "auditor"],
		["an empty role", ""],
		["a null role", null],
		["an absent role", undefined],
	])("treats %s as unprivileged, never as admin", (_label, role) => {
		const actor = { id: "user-x", role } as Actor;
		expect(memberScopeFor(actor, [])).toEqual({
			kind: "leaderOf",
			memberIds: [],
		});
	});

	it("does not treat a role that merely contains 'admin' as admin", () => {
		const actor = { id: "user-x", role: "not-admin" } as Actor;
		expect(memberScopeFor(actor, ["m1"]).kind).toBe("leaderOf");
	});
});
