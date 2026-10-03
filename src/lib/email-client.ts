import { APP_NAME } from "./app.ts";

const RESEND_API_URL = "https://api.resend.com/emails";

const DEFAULT_FROM = `${APP_NAME} <noreply@notifications.everynationcampuswits.org>`;

/**
 * Plain `fetch` against the Resend REST API — no SDK, same convention as
 * `whatsapp-client.ts` for the other outbound-message integration. Throws on
 * failure; callers on a critical path (password reset, email verification)
 * catch and log rather than let a Resend outage break sign-in, while callers
 * that treat email as a bonus delivery channel (credential emails) catch it
 * to report back "couldn't email this, share it directly" instead.
 */
export async function sendEmail({
	to,
	subject,
	html,
}: {
	to: string;
	subject: string;
	html: string;
}): Promise<void> {
	const apiKey = process.env.RESEND_API_KEY;
	if (!apiKey) {
		throw new Error("RESEND_API_KEY is not configured.");
	}

	const response = await fetch(RESEND_API_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM,
			to,
			subject,
			html,
		}),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Resend request failed (${response.status}): ${body}`);
	}
}

/**
 * Consistent, minimal branded wrapper — a heading, a body, and an optional
 * button-styled link — shared by every email this app sends, so a new
 * notification doesn't mean a new template from scratch.
 */
export function renderEmailLayout({
	heading,
	bodyHtml,
	action,
}: {
	heading: string;
	bodyHtml: string;
	action?: { label: string; url: string };
}): string {
	return `
		<div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #18181b;">
			<p style="font-size: 13px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #71717a; margin: 0 0 24px;">${APP_NAME}</p>
			<h1 style="font-size: 20px; font-weight: 600; margin: 0 0 16px;">${heading}</h1>
			<div style="font-size: 14px; line-height: 1.6; color: #3f3f46;">${bodyHtml}</div>
			${
				action
					? `<p style="margin: 24px 0 0;">
							<a href="${action.url}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 500; padding: 10px 20px; border-radius: 6px;">${action.label}</a>
						</p>`
					: ""
			}
		</div>
	`;
}
