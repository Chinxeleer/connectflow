CREATE TYPE "public"."intake_reconciliation_resolution" AS ENUM('updated_existing', 'created_new', 'discarded');--> statement-breakpoint
CREATE TYPE "public"."intake_reconciliation_status" AS ENUM('pending', 'resolved');--> statement-breakpoint
CREATE TABLE "intake_reconciliation_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reconciliation_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"match_reason" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_reconciliations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"status" "intake_reconciliation_status" DEFAULT 'pending' NOT NULL,
	"resolution" "intake_reconciliation_resolution",
	"resolved_member_id" uuid,
	"resolved_by" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "intake_reconciliation_candidates" ADD CONSTRAINT "intake_reconciliation_candidates_reconciliation_id_intake_reconciliations_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "public"."intake_reconciliations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_reconciliation_candidates" ADD CONSTRAINT "intake_reconciliation_candidates_person_id_members_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_reconciliations" ADD CONSTRAINT "intake_reconciliations_resolved_member_id_members_id_fk" FOREIGN KEY ("resolved_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_reconciliations" ADD CONSTRAINT "intake_reconciliations_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;