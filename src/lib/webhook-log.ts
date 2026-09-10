import { db } from "@/db/index.ts";
import {
	type WebhookLogOutcome,
	type WebhookLogSource,
	webhookLogs,
} from "@/db/schema/webhook-logs.ts";

/**
 * Writes one durable audit row for a webhook call — accepted or rejected.
 * Never throws: a logging failure must not turn an otherwise-successful
 * webhook call into a 500, so this swallows its own errors after reporting
 * them to the console.
 */
export async function logWebhookEvent(entry: {
	source: WebhookLogSource;
	outcome: WebhookLogOutcome;
	reason: string;
	payload: unknown;
	memberId?: string;
}): Promise<void> {
	try {
		await db.insert(webhookLogs).values({
			source: entry.source,
			outcome: entry.outcome,
			reason: entry.reason,
			payload: entry.payload,
			memberId: entry.memberId,
		});
	} catch (error) {
		console.error("Failed to write webhook audit log", error);
	}
}
