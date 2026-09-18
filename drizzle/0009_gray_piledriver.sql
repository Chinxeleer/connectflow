CREATE TYPE "public"."ministry" AS ENUM('sound_and_setup', 'multimedia', 'hosting', 'band');--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "ministry" "ministry";