import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Access-control definitions for better-auth's `admin()` plugin.
 *
 * This exists purely so `leader` is a role the plugin knows about — without it
 * the plugin's roles are fixed at `user | admin` and `createUser` refuses a
 * `leader`. Application-level checks stay in `@/lib/permissions`.
 */
const statement = { ...defaultStatements } as const;

export const ac = createAccessControl(statement);

/** Full user- and session-management rights. */
export const adminRole = ac.newRole({ ...adminAc.statements });

/**
 * Leaders manage no accounts at all — they are scoped to their own assigned
 * members, which is enforced in each feature's `action.ts`/`query.ts`.
 */
export const leaderRole = ac.newRole({ user: [], session: [] });

export const roles = { admin: adminRole, leader: leaderRole };
