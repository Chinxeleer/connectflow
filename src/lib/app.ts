/**
 * The name shown to users.
 *
 * Deliberately separate from the project's identity: the package, repository
 * and worker stay `connectflow`, while the app presents itself as the ministry
 * it belongs to. Change it here and it changes everywhere it is displayed.
 */
export const APP_NAME = "ENC Wits";

/**
 * The app's own canonical origin, no trailing slash — the same source of
 * truth `auth.ts` relies on to build password-reset/verification links (see
 * `wrangler.jsonc`'s `vars` and CLAUDE.md's Environment variables section:
 * `BETTER_AUTH_URL` is pinned there for production rather than left to a
 * per-request fallback).
 *
 * Deliberately read from here, not from the request that happens to trigger
 * a given email: a webhook call or an admin's "grant access" click has no
 * request origin a human should actually be sent to, and recovering one
 * from forwarded headers is exactly the kind of thing that works until it
 * quietly doesn't. Falls back to local dev's own default so this doesn't
 * throw when `BETTER_AUTH_URL` is unset.
 */
export function getAppUrl(): string {
	return process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
}
