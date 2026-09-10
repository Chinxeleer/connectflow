import {
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { members } from "./members.ts";

/**
 * One row per webhook source, not one shared "google_forms" value — a second
 * form (or a future WhatsApp inbound webhook) adds a value here rather than
 * needing a separate log table.
 */
export const webhookLogSource = pgEnum("webhook_log_source", [
	"google_forms_member_intake",
	"google_forms_member_removal",
]);

export const webhookLogOutcome = pgEnum("webhook_log_outcome", [
	"accepted",
	"rejected",
]);

export type WebhookLogSource = (typeof webhookLogSource.enumValues)[number];
export type WebhookLogOutcome = (typeof webhookLogOutcome.enumValues)[number];

/**
 * Durable audit trail for every webhook call, accepted or rejected — the
 * shared-secret check has no session to fall back on for "who did this", so
 * this is the only record of what a caller sent and what we did with it.
 */
export const webhookLogs = pgTable("webhook_logs", {
	id: uuid("id").primaryKey().defaultRandom(),
	source: webhookLogSource("source").notNull(),
	outcome: webhookLogOutcome("outcome").notNull(),

	/** Short human-readable summary — "matched and marked inactive: X", "ambiguous: 3 matches", a validation error, etc. */
	reason: text("reason"),

	/** The raw payload as received, whether or not it parsed or validated. */
	payload: jsonb("payload").notNull(),

	/** The member this call affected, if any. */
	memberId: uuid("member_id").references(() => members.id, {
		onDelete: "set null",
	}),

	receivedAt: timestamp("received_at").defaultNow().notNull(),
});

export type WebhookLog = typeof webhookLogs.$inferSelect;
export type NewWebhookLog = typeof webhookLogs.$inferInsert;
