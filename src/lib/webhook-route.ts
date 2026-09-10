import type { z } from "zod";
import type { WebhookLogSource } from "@/db/schema/webhook-logs.ts";
import { requireWebhookSecret, WebhookAuthError } from "./webhook-auth.ts";
import { logWebhookEvent } from "./webhook-log.ts";

export type WebhookHandlerResult = {
	status: number;
	body: unknown;
	/** One-line summary stored in the audit log's `reason` column. */
	reason: string;
	memberId?: string;
};

/**
 * Shared shape for every Google Forms webhook route: verify the secret, parse
 * and validate the body, hand the validated payload to `handle`, and log the
 * outcome either way. The body is read exactly once — as text, then parsed —
 * so a malformed body still gets logged as raw text rather than throwing away
 * the offending payload.
 *
 * Auth runs *before* validation so a caller without the secret cannot use
 * this endpoint to probe what a valid payload looks like.
 *
 * Every step also prints to the console with a `[webhook:<source>]` prefix —
 * greppable in Cloudflare's live Logs / `wrangler tail` while a real
 * submission is in flight, which is faster to watch than querying
 * `webhook_logs` after the fact. The DB row is still the durable record;
 * this is only for watching it happen.
 */
export async function handleGoogleFormsWebhook<T>(
	request: Request,
	options: {
		source: WebhookLogSource;
		schema: z.ZodType<T>;
		handle: (data: T) => Promise<WebhookHandlerResult>;
	},
): Promise<Response> {
	const tag = `[webhook:${options.source}]`;

	const rawText = await request.text();
	console.log(`${tag} received`, rawText);

	let rawBody: unknown;
	try {
		rawBody = rawText.length > 0 ? JSON.parse(rawText) : undefined;
	} catch {
		rawBody = { raw: rawText };
		console.error(`${tag} body was not valid JSON`);
	}

	try {
		requireWebhookSecret(request);
	} catch (error) {
		if (error instanceof WebhookAuthError) {
			console.error(`${tag} rejected: ${error.message}`);
			await logWebhookEvent({
				source: options.source,
				outcome: "rejected",
				reason: error.message,
				payload: rawBody ?? null,
			});
			return Response.json({ error: error.message }, { status: 401 });
		}
		throw error;
	}

	const parsed = options.schema.safeParse(rawBody);
	if (!parsed.success) {
		const reason = parsed.error.issues
			.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
			.join("; ");
		console.error(`${tag} rejected: ${reason || "Invalid payload."}`, rawBody);
		await logWebhookEvent({
			source: options.source,
			outcome: "rejected",
			reason: reason || "Invalid payload.",
			payload: rawBody ?? null,
		});
		return Response.json(
			{ error: "Invalid payload.", details: reason },
			{ status: 400 },
		);
	}

	const result = await options.handle(parsed.data);
	console.log(`${tag} accepted: ${result.reason}`);
	await logWebhookEvent({
		source: options.source,
		outcome: "accepted",
		reason: result.reason,
		payload: rawBody ?? null,
		memberId: result.memberId,
	});

	return Response.json(result.body, { status: result.status });
}
