import { eq, inArray, isNull, or, type SQL, sql } from "drizzle-orm";
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

/* -------------------------------------------------------------------------
 * Walking the tree
 *
 * Everything above answers "who reports directly to me", which is what the
 * members list and the stats cards ask. The hierarchy page and the member
 * profile ask a different question — "who is anywhere below me" — and that one
 * is recursive. Both rules live here so there is still exactly one file that
 * decides what an account can reach.
 *
 * Seeing someone is not the same as being able to change them: the recursive
 * rule governs *viewing* only. Editing stays direct reports and yourself, and
 * that decision lives in `update-member-profile/guard.ts`.
 * ---------------------------------------------------------------------- */

/**
 * How far a hierarchy walk goes, in either direction.
 *
 * A connect structure is roughly church -> zone -> cell -> member, so ten is
 * generous headroom. It is a cost bound, not the safety net: the cycle guards
 * below are what guarantee a walk terminates. It also bounds how deep the tree
 * component recurses, so keep the two single-sourced from here.
 */
export const MAX_HIERARCHY_DEPTH = 10;

/** Anything that can run a query — the `db` singleton, or an open transaction. */
type Executor = Pick<typeof db, "execute">;

/**
 * Where a downward walk starts.
 *
 * Deliberately *not* the `undefined` means "no filter" convention used by
 * `memberScopeWhere`: an admin's tree is anchored on the members who have no
 * leader, which is a real predicate, not the absence of one. Returning
 * `undefined` here would read as "start from every row" and render the whole
 * table as roots.
 */
export function hierarchyRootsWhere(scope: MemberScope): SQL {
	if (scope.kind === "all") return isNull(members.leaderId);
	if (scope.memberIds.length === 0) return matchesNothing();

	return inArray(members.id, scope.memberIds);
}

/**
 * May this scope open that member's profile at all?
 *
 * Pure, so the rule can be tested without a database: `ancestorIds` is the
 * member's leader chain, which `ancestorMemberIdsFor` fetches.
 *
 * A leader with no linked member row reaches nobody — the same fail-closed
 * answer their member list gives, and the one mistake here that would matter.
 */
export function inDownlineOf(
	scope: MemberScope,
	memberId: string,
	ancestorIds: ReadonlyArray<string>,
): boolean {
	if (scope.kind === "all") return true;
	if (scope.memberIds.length === 0) return false;
	if (scope.memberIds.includes(memberId)) return true;

	return ancestorIds.some((id) => scope.memberIds.includes(id));
}

/**
 * The leaders above a member, nearest first, excluding the member themselves.
 *
 * Walks *up* rather than materialising a subtree: `leaderId` is single-valued,
 * so this is one row per level — bounded by `MAX_HIERARCHY_DEPTH` — where the
 * downward equivalent would fetch everyone below the caller just to answer a
 * yes/no question about one member.
 *
 * `up.id <> all(chain.path)` is the cycle guard. `leaderId` is only protected
 * by a `restrict` foreign key, which prevents deletion, not a loop: both
 * `A -> A` and `A -> B -> A` are storable, and without the guard this recurses
 * forever instead of returning.
 */
export async function ancestorMemberIdsFor(
	memberId: string,
	executor: Executor = db,
): Promise<string[]> {
	const result = await executor.execute<{ id: string }>(sql`
		with recursive chain as (
			select id, leader_id, 1 as depth, array[id] as path
			from ${members}
			where id = ${memberId}

			union all

			select up.id, up.leader_id, chain.depth + 1, chain.path || up.id
			from ${members} as up
			join chain on chain.leader_id = up.id
			where chain.depth < ${MAX_HIERARCHY_DEPTH}
			  and up.id <> all(chain.path)
		)
		select id from chain where id <> ${memberId} order by depth asc
	`);

	return result.rows.map((row) => row.id);
}

/**
 * Would moving `memberId` under `newLeaderId` close a loop?
 *
 * True when the proposed leader is the member themselves, or already sits
 * below them — reparenting is the only way a human can create a cycle, so it
 * is the place to refuse one.
 */
export async function wouldLoopTheTree(
	memberId: string,
	newLeaderId: string,
	executor: Executor = db,
): Promise<boolean> {
	if (memberId === newLeaderId) return true;

	const ancestors = await ancestorMemberIdsFor(newLeaderId, executor);

	return ancestors.includes(memberId);
}
