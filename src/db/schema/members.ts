import { relations } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
	index,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.ts";

/**
 * Where a member is in the connect-group journey. `new` is the landing state
 * for intake (form webhook or CSV import); everything else is moved by hand or
 * by the matching run.
 */
export const memberStatus = pgEnum("member_status", [
	"new",
	"contacted",
	"assigned",
	"inducted",
	"inactive",
]);

export type MemberStatus = (typeof memberStatus.enumValues)[number];

/**
 * Fixed set of five areas a member stays in. Not user-editable — there is no
 * settings screen for this list, unlike `memberStatus`. Also carried by a
 * connect: a connect's area is its leader's own `areaGroup`, since nothing in
 * this schema stores a connect as a row of its own — a connect leader is a
 * member, so there is only one `areaGroup` to set.
 */
export const areaGroup = pgEnum("area_group", [
	"main_central",
	"parktown_east",
	"parktown_west",
	"braamfontein_east",
	"braamfontein_west",
]);

export type AreaGroup = (typeof areaGroup.enumValues)[number];

/** Display label for each area group, keyed by its stored enum value. */
export const AREA_GROUP_LABELS: Record<AreaGroup, string> = {
	main_central: "Main (Central)",
	parktown_east: "Parktown East",
	parktown_west: "Parktown West",
	braamfontein_east: "Braamfontein East",
	braamfontein_west: "Braamfontein West",
};

/** Undergrad years one through six, plus postgrad as its own value rather than a seventh year. */
export const yearOfStudy = pgEnum("year_of_study", [
	"year_1",
	"year_2",
	"year_3",
	"year_4",
	"year_5",
	"year_6",
	"postgrad",
]);

export type YearOfStudy = (typeof yearOfStudy.enumValues)[number];

/** Display label for each year of study, keyed by its stored enum value. */
export const YEAR_OF_STUDY_LABELS: Record<YearOfStudy, string> = {
	year_1: "Year 1",
	year_2: "Year 2",
	year_3: "Year 3",
	year_4: "Year 4",
	year_5: "Year 5",
	year_6: "Year 6",
	postgrad: "Postgrad",
};

export const members = pgTable(
	"members",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		phone: text("phone"),
		email: text("email"),

		/**
		 * A member row that stands in for the ministry itself, not a person —
		 * e.g. a top-of-tree entity assigned as the nominal leader for a
		 * leader/elder/pastor who doesn't report to anyone. Still a normal
		 * `leaderId` target (self-referencing, so it must be a member row like
		 * any other), but excluded from the member roster and anywhere else
		 * "how many members" is being counted, since it isn't one.
		 */
		isOrganization: boolean("is_organization").default(false).notNull(),

		/**
		 * Profile fields backfilled later by the member themselves. Null is the
		 * normal state for an imported row, not an error — the members table
		 * surfaces it as an "Incomplete" badge.
		 */
		gender: text("gender"),
		residence: text("residence"),
		fieldOfStudy: text("field_of_study"),

		/**
		 * Where the member stays, as one of the five fixed areas. Same
		 * backfilled-later convention as the profile fields above: null until
		 * set, on an existing row as much as an imported one.
		 */
		areaGroup: areaGroup("area_group"),

		/** Same backfilled-later convention: null until the member sets it. */
		yearOfStudy: yearOfStudy("year_of_study"),

		status: memberStatus("status").default("new").notNull(),

		/**
		 * Set only by a soft-delete — the member-removal webhook, or an admin
		 * resolving a `pending_removals` row. Null means "never removed", not
		 * "unknown": a member set to `inactive` by hand for some other reason
		 * leaves this null, so the two cannot be confused later. We never
		 * hard-delete a member this way, matching the `restrict` rule on
		 * `leaderId` below — a removed leader still anchors their reports.
		 */
		removedAt: timestamp("removed_at"),

		/**
		 * The member's connect leader — a self-reference, because leaders are
		 * themselves members. `restrict` is the backstop for the delete rule:
		 * a member with people reporting to them cannot be removed, and their
		 * reports are never cascaded or silently orphaned.
		 */
		leaderId: uuid("leader_id").references((): AnyPgColumn => members.id, {
			onDelete: "restrict",
		}),

		/**
		 * Optional link to a login account. This is what scopes a signed-in
		 * leader to their own people: their session user resolves to this row,
		 * and they see members whose `leaderId` is it. A member with no account
		 * simply cannot sign in.
		 */
		userId: text("user_id").references(() => user.id, { onDelete: "set null" }),

		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => new Date())
			.notNull(),
	},
	(table) => [
		index("members_leader_id_idx").on(table.leaderId),
		index("members_user_id_idx").on(table.userId),
		index("members_status_idx").on(table.status),
		index("members_area_group_idx").on(table.areaGroup),
	],
);

export const membersRelations = relations(members, ({ one, many }) => ({
	leader: one(members, {
		fields: [members.leaderId],
		references: [members.id],
		relationName: "member_leader",
	}),
	reports: many(members, { relationName: "member_leader" }),
	account: one(user, { fields: [members.userId], references: [user.id] }),
}));

export type Member = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
