CREATE TYPE "public"."pending_removal_status" AS ENUM('pending', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."webhook_log_outcome" AS ENUM('accepted', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."webhook_log_source" AS ENUM('google_forms_member_intake', 'google_forms_member_removal');--> statement-breakpoint
CREATE TABLE "pending_removals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"surname" text NOT NULL,
	"submitted_at" timestamp NOT NULL,
	"status" "pending_removal_status" DEFAULT 'pending' NOT NULL,
	"resolved_member_id" uuid,
	"resolved_by" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "webhook_log_source" NOT NULL,
	"outcome" "webhook_log_outcome" NOT NULL,
	"reason" text,
	"payload" jsonb NOT NULL,
	"member_id" uuid,
	"received_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "removed_at" timestamp;--> statement-breakpoint
ALTER TABLE "pending_removals" ADD CONSTRAINT "pending_removals_resolved_member_id_members_id_fk" FOREIGN KEY ("resolved_member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pending_removals" ADD CONSTRAINT "pending_removals_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE set null ON UPDATE no action;