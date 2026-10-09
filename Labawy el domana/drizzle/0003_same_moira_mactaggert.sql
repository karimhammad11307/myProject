ALTER TABLE "members" ADD COLUMN "name_override" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "avatar_override" text;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "valid_member_name_override" CHECK ("members"."name_override" is null or length("members"."name_override") between 1 and 60);--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "valid_member_avatar_override" CHECK ("members"."avatar_override" is null or "members"."avatar_override" in ('olive','coffee','amber','rose','sky','violet'));