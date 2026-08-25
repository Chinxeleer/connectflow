import { eq, inArray, or, type SQL, sql } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { members } from "@/db/schema/members.ts";
import { type Actor, isAdmin, requireActor } from "@/lib/permissions.ts";

/**
 * Which members a signed-in account may see.
 *
 * `all` — an admin: the whole table.
 * `leaderOf` — a leader: only members whose `leaderId` is one of the member
 *   rows linked to their account. Direct reports only; this is deliberately
 *   not recursive, so a leader cannot see their sub-leaders' people.
 *
 * An empty `memberIds` is a real, expected state — a leader account with no
 * linked member row leads nobody, and must see nothing rather than everything.
 */
export type MemberScope =
	| { kind: "all" }
	| { kind: "leaderOf"; memberIds: string[] };

/**
 * The scope decision on its own, with no database access, so the rule can be
 * tested exhaustively. `linkedMemberIds` is what the account resolves to.
 */
export function memberScopeFor(
	actor: Actor,
	linkedMemberIds: string[],
): MemberScope {
	if (isAdmin(actor)) return { kind: "all" };
	return { kind: "leaderOf", memberIds: linkedMemberIds };
}

/**
 * Turns a scope into a SQL predicate.
 *
 * Returns `undefined` for an admin, meaning "no filter". Every caller must
 * treat `undefined` as admin-only — never as "match everything" for a leader.
 * A leader scoped to no members yields a predicate that matches no rows.
 */
export function memberScopeWhere(scope: MemberScope): SQL | undefined {
	if (scope.kind === "all") return undefined;
	if (scope.memberIds.length === 0) return matchesNothing();
	return inArray(members.leaderId, scope.memberIds);
}

/**
 * Like `memberScopeWhere`, but also matches the actor's *own* member rows.
 *
 * The members table asks "who is under me", so a leader should not see their
 * own row there. A leaders list asks "who leads a connect", where excluding
 * the person reading it would be nonsense. Everything matched is still inside
 * their own subtree, so nothing new is exposed.
 */
export function memberScopeWithSelfWhere(scope: MemberScope): SQL | undefined {
	if (scope.kind === "all") return undefined;
	if (scope.memberIds.length === 0) return matchesNothing();

	return or(
		inArray(members.leaderId, scope.memberIds),
		inArray(members.id, scope.memberIds),
	) as SQL;
}

/**
 * A predicate that is false for every row, so a leader scoped to no members
 * sees an empty list rather than the whole table.
 */
function matchesNothing(): SQL {
	return sql`false`;
}

/** Member rows an account is linked to; a leader leads on behalf of these. */
export async function linkedMemberIdsFor(userId: string): Promise<string[]> {
	const rows = await db
		.select({ id: members.id })
		.from(members)
		.where(eq(members.userId, userId));

	return rows.map((row) => row.id);
}

/** Resolves the caller's scope, hitting the database only when it must. */
export async function resolveMemberScope(
	actor: Actor | null | undefined,
): Promise<MemberScope> {
	const current = requireActor(actor);
	if (isAdmin(current)) return { kind: "all" };

	return memberScopeFor(current, await linkedMemberIdsFor(current.id));
}
