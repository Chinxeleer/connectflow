/**
 * Accounts that can never be demoted from admin, by anyone, regardless of
 * how many other admins exist. `setUserRole`'s "last admin" guard already
 * stops the count from ever reaching zero, but that's a moving target — it
 * stops working the moment a second admin exists. This is a fixed floor
 * underneath it: the org's own account always keeps access, independent of
 * who else has been promoted or demoted around it.
 *
 * A plain constant, not a database column, on purpose — this is small
 * enough (one account today) that a config file an engineer edits and
 * redeploys is more legible than a toggle living in a table, and it can't
 * be flipped by a role-change bug or a stray admin action.
 */
const PROTECTED_ADMIN_EMAILS: ReadonlySet<string> = new Set([
	"blessingeleer@gmail.com",
]);

export function isProtectedAdmin(email: string): boolean {
	return PROTECTED_ADMIN_EMAILS.has(email.toLowerCase());
}
