const HEADER_NAME = "x-webhook-secret";

export class WebhookAuthError extends Error {
	readonly status = 401;

	constructor(message = "Missing or invalid webhook secret.") {
		super(message);
		this.name = "WebhookAuthError";
	}
}

/**
 * Constant-time string compare — a plain `===` leaks how many leading bytes
 * matched through response timing, which matters for a long-lived shared
 * secret compared on every request. No `node:crypto` needed for this; a
 * manual XOR accumulator is the standard equivalent and works identically
 * under workerd and Node.
 */
function timingSafeEqual(a: string, b: string): boolean {
	const aBytes = new TextEncoder().encode(a);
	const bBytes = new TextEncoder().encode(b);
	if (aBytes.length !== bBytes.length) return false;

	let diff = 0;
	for (let i = 0; i < aBytes.length; i++) {
		// biome-ignore lint/style/noNonNullAssertion: i < aBytes.length by construction
		diff |= aBytes[i]! ^ bBytes[i]!;
	}
	return diff === 0;
}

/**
 * The auth check every webhook route (Google Forms today, WhatsApp later)
 * gates on in place of a user session — these callers have no session to
 * check, so this is the *only* gate, not defence in depth alongside one.
 * Throws rather than returning a boolean so a call site that forgets to
 * check a return value fails loudly instead of silently letting the
 * request through.
 */
export function requireWebhookSecret(request: Request): void {
	const expected = process.env.GOOGLE_FORMS_WEBHOOK_SECRET;
	if (!expected) {
		throw new Error("GOOGLE_FORMS_WEBHOOK_SECRET is not configured.");
	}

	const provided = request.headers.get(HEADER_NAME);
	if (!provided || !timingSafeEqual(provided, expected)) {
		throw new WebhookAuthError();
	}
}
