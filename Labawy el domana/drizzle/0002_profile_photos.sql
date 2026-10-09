ALTER TABLE "players" ADD COLUMN "photo" "bytea";--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "photo_version" integer DEFAULT 0 NOT NULL;