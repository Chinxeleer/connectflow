import { relations } from "drizzle-orm";
import {
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.ts";
import { members } from "./members.ts";

/**
 * `jsonb` infers as `unknown` by default, which `createServerFn` refuses to
 * return — its serializability check can't prove `unknown` is safe to cross
 * the client/server RPC boundary. `rawPayload` is always the parsed body of
 * a webhook's JSON request, so it's always one of these.
 */
export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

/**
 * `pending` is the landing state for an intake submission `matchPerson`
 * couldn't confidently resolve on its own. `resolved` means an admin decided
 * what it was — see `intakeReconciliationResolution` for which of the three
 * things that decision was.
 */
export const intakeReconciliationStatus = pgEnum(
	"intake_reconciliation_status",
	["pending", "resolved"],
);

export type IntakeReconciliationStatus =
	(typeof intakeReconciliationStatus.enumValues)[number];

/**
 * What an admin decided a pending reconciliation actually was:
 * `updated_existing` — one of the listed candidates, backfilled from the
 * submission; `created_new` — genuinely a new person, despite the
 * candidates; `discarded` — not applicable at all (spam, a duplicate,
 * a mistaken submission) and no person record touched.
 */
export const intakeReconciliationResolution = pgEnum(
	"intake_reconciliation_resolution",
	["updated_existing", "created_new", "discarded"],
);

export type IntakeReconciliationResolution =
	(typeof intakeReconciliationResolution.enumValues)[number];

export const intakeReconciliations = pgTable("intake_reconciliations", {
	id: uuid("id").primaryKey().defaultRandom(),

	/** The submission exactly as received, so a human can see everything the form sent. */
	rawPayload: jsonb("raw_payload").$type<JsonValue>().notNull(),

	status: intakeReconciliationStatus("status").default("pending").notNull(),
	resolution: intakeReconciliationResolution("resolution"),

	/** Who this reconciliation ended up affecting — the updated or newly-created member. Null until resolved, and null forever if discarded. */
	resolvedMemberId: uuid("resolved_member_id").references(() => members.id, {
		onDelete: "set null",
	}),
	resolvedBy: text("resolved_by").references(() => user.id, {
		onDelete: "set null",
	}),
	resolvedAt: timestamp("resolved_at"),

	createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * A reconciliation lists every plausible candidate `matchPerson` found —
 * never just its best guess — so the admin resolving it sees the same
 * ambiguity the webhook saw, with the reason each one was considered.
 */
export const intakeReconciliationCandidates = pgTable(
	"intake_reconciliation_candidates",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		reconciliationId: uuid("reconciliation_id")
			.notNull()
			.references(() => intakeReconciliations.id, { onDelete: "cascade" }),
		personId: uuid("person_id")
			.notNull()
			.references(() => members.id, { onDelete: "cascade" }),
		matchReason: text("match_reason").notNull(),
	},
);

export const intakeReconciliationsRelations = relations(
	intakeReconciliations,
	({ one, many }) => ({
		resolvedMember: one(members, {
			fields: [intakeReconciliations.resolvedMemberId],
			references: [members.id],
		}),
		resolvedByUser: one(user, {
			fields: [intakeReconciliations.resolvedBy],
			references: [user.id],
		}),
		candidates: many(intakeReconciliationCandidates),
	}),
);

export const intakeReconciliationCandidatesRelations = relations(
	intakeReconciliationCandidates,
	({ one }) => ({
		reconciliation: one(intakeReconciliations, {
			fields: [intakeReconciliationCandidates.reconciliationId],
			references: [intakeReconciliations.id],
		}),
		person: one(members, {
			fields: [intakeReconciliationCandidates.personId],
			references: [members.id],
		}),
	}),
);

export type IntakeReconciliation = typeof intakeReconciliations.$inferSelect;
export type NewIntakeReconciliation = typeof intakeReconciliations.$inferInsert;
export type IntakeReconciliationCandidate =
	typeof intakeReconciliationCandidates.$inferSelect;
export type NewIntakeReconciliationCandidate =
	typeof intakeReconciliationCandidates.$inferInsert;
