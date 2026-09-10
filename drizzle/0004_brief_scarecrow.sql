CREATE TYPE "public"."area_group" AS ENUM('main_central', 'parktown_east', 'parktown_west', 'braamfontein_east', 'braamfontein_west');--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "area_group" "area_group";--> statement-breakpoint
CREATE INDEX "members_area_group_idx" ON "members" USING btree ("area_group");