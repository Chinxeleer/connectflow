import { relations } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.ts";
import { members } from "./members.ts";

/**
 * `pending` is the landing state for a removal request the Google Form
 * webhook could not resolve on its own — zero or several members matched the
 * submitted name. `resolved` means an admin picked the right member and it
 * was soft-deleted; `dismissed` means an admin decided the request does not
 * apply to anyone (a typo, a duplicate submission, spam) and no member was
 * touched. These are deliberately distinct: only one of them means a member
 * record changed.
 */
export const pendingRemovalStatus = pgEnum("pending_removal_status", [
	"pending",
	"resolved",
	"dismissed",
]);

export type PendingRemovalStatus =
	(typeof pendingRemovalStatus.enumValues)[number];

export const pendingRemovals = pgTable("pending_removals", {
	id: uuid("id").primaryKey().defaultRandom(),
	firstName: text("first_name").notNull(),
	surname: text("surname").notNull(),

	/** When the Google Form was submitted, not when this row was written. */
	submittedAt: timestamp("submitted_at").notNull(),

	status: pendingRemovalStatus("status").default("pending").notNull(),

	/** The member an admin picked when resolving this — null until then. */
	resolvedMemberId: uuid("resolved_member_id").references(() => members.id, {
		onDelete: "set null",
	}),
	resolvedBy: text("resolved_by").references(() => user.id, {
		onDelete: "set null",
	}),
	resolvedAt: timestamp("resolved_at"),

	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pendingRemovalsRelations = relations(
	pendingRemovals,
	({ one }) => ({
		resolvedMember: one(members, {
			fields: [pendingRemovals.resolvedMemberId],
			references: [members.id],
		}),
		resolvedByUser: one(user, {
			fields: [pendingRemovals.resolvedBy],
			references: [user.id],
		}),
	}),
);

export type PendingRemoval = typeof pendingRemovals.$inferSelect;
export type NewPendingRemoval = typeof pendingRemovals.$inferInsert;
