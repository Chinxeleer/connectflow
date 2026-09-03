import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import type { Actor } from "@/lib/permissions.ts";
import {
	hierarchyRootsWhere,
	inDownlineOf,
	type MemberScope,
	memberScopeFor,
} from "./scope.ts";

const admin: Actor = { id: "user-admin", role: "admin" };
const leader: Actor = { id: "user-leader", role: "leader" };

/**
 * Renders a predicate to SQL without a database, so these assert what Postgres
 * will actually be asked rather than the shape of a drizzle object.
 */
const dialect = new PgDialect();
const render = (fragment: SQL) => dialect.sqlToQuery(fragment);

const allScope: MemberScope = { kind: "all" };
const leaderOf = (...memberIds: string[]): MemberScope => ({
	kind: "leaderOf",
	memberIds,
});

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

describe("hierarchyRootsWhere", () => {
	it("anchors an admin's walk on the members who have no leader", () => {
		// Not "every row": an admin's tree starts at the top of each connect,
		// and the descendants arrive by recursion.
		expect(render(hierarchyRootsWhere(allScope)).sql).toContain(
			'"leader_id" is null',
		);
	});

	it("anchors a leader's walk on their own linked member rows", () => {
		const query = render(hierarchyRootsWhere(leaderOf("member-1")));

		expect(query.sql).toContain('"id" in');
		expect(query.params).toEqual(["member-1"]);
	});

	it("anchors a leader linked to several member rows on all of them", () => {
		expect(render(hierarchyRootsWhere(leaderOf("m1", "m2"))).params).toEqual([
			"m1",
			"m2",
		]);
	});

	it("matches nothing for a leader with no linked member row, rather than every root", () => {
		// Falling through to the admin anchor here would root one leader's tree
		// at the top of every connect in the system.
		expect(render(hierarchyRootsWhere(leaderOf())).sql).toBe("false");
	});

	it("parameterises the linked ids rather than inlining them", () => {
		expect(render(hierarchyRootsWhere(leaderOf("m1"))).sql).not.toContain("m1");
	});
});

describe("inDownlineOf", () => {
	it("lets an admin open any profile", () => {
		expect(inDownlineOf(allScope, "anyone", [])).toBe(true);
	});

	it("lets a leader open their own profile", () => {
		expect(inDownlineOf(leaderOf("grace"), "grace", [])).toBe(true);
	});

	it("lets a leader open a direct report's profile", () => {
		expect(inDownlineOf(leaderOf("grace"), "ada", ["grace"])).toBe(true);
	});

	it("lets a leader open a profile further down their tree, not just direct reports", () => {
		// The tree shows a whole downline, so every node it renders must open.
		expect(
			inDownlineOf(leaderOf("grace"), "mary", ["katherine", "grace"]),
		).toBe(true);
	});

	it("refuses a profile whose leader chain never reaches the leader", () => {
		expect(inDownlineOf(leaderOf("grace"), "mary", ["katherine"])).toBe(false);
	});

	it("refuses every profile for a leader with no linked member row, rather than allowing all of them", () => {
		expect(inDownlineOf(leaderOf(), "anyone", ["someone"])).toBe(false);
	});

	it("matches on any one of several linked member rows", () => {
		expect(
			inDownlineOf(leaderOf("grace", "katherine"), "mary", ["katherine"]),
		).toBe(true);
	});

	it("refuses an unassigned member, who sits in nobody's downline", () => {
		expect(inDownlineOf(leaderOf("grace"), "stranger", [])).toBe(false);
	});
});
