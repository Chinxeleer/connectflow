import type { UserRole } from "@/db/schema/auth.ts";

/**
 * Role -> allowed-action checks. Every `action.ts` under `src/features/` must
 * call one of these before touching the database — the UI hiding a button is
 * never the access control.
 */

/**
 * The minimum shape a check needs; satisfied by better-auth's session user.
 *
 * `role` is deliberately widened to `string | null | undefined` because that is
 * what the session actually carries — the `admin()` plugin does not narrow it
 * to our enum. Never compare a raw role outside this module; use the helpers,
 * which treat anything unrecognised as unprivileged.
 */
export type Actor = {
	id: string;
	role?: string | null;
};

export class PermissionError extends Error {
	readonly status = 403;

	constructor(message = "You do not have permission to do that.") {
		super(message);
		this.name = "PermissionError";
	}
}

export class UnauthenticatedError extends Error {
	readonly status = 401;

	constructor(message = "You must be signed in.") {
		super(message);
		this.name = "UnauthenticatedError";
	}
}

const ADMIN: UserRole = "admin";
const LEADER: UserRole = "leader";

/**
 * Anything carrying a role. Narrower than `Actor` on purpose: these two only
 * read the role, so they also work where no id is to hand — the sidebar, for
 * instance, which knows who is signed in but not their user id.
 */
type HasRole = Pick<Actor, "role">;

export function isAdmin(actor: HasRole | null | undefined): boolean {
	return actor?.role === ADMIN;
}

export function isLeader(actor: HasRole | null | undefined): boolean {
	return actor?.role === LEADER;
}

/** Narrows a possibly-null actor, throwing if there is no session. */
export function requireActor(actor: Actor | null | undefined): Actor {
	if (!actor) throw new UnauthenticatedError();
	return actor;
}

/** Admin-only surfaces: settings, matching runs, the global review queue. */
export function requireAdmin(actor: Actor | null | undefined): Actor {
	const current = requireActor(actor);
	if (!isAdmin(current)) throw new PermissionError();
	return current;
}

/**
 * Guards a resource owned by a single leader. Admins pass for any owner;
 * a leader passes only for their own rows.
 */
export function requireOwnerOrAdmin(
	actor: Actor | null | undefined,
	ownerId: string | null | undefined,
): Actor {
	const current = requireActor(actor);
	if (isAdmin(current)) return current;
	if (ownerId && ownerId === current.id) return current;
	throw new PermissionError();
}

/**
 * The leader whose rows a query should be scoped to, or `null` for "no scope"
 * (admin sees everything). Use this in `query.ts` so filtering happens in SQL
 * rather than by hiding columns in the UI.
 */
export function ownerScopeFor(actor: Actor): string | null {
	return isAdmin(actor) ? null : actor.id;
}
