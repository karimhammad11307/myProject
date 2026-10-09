CREATE TABLE "active_seats" (
	"league_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	CONSTRAINT "active_seats_league_id_player_id_pk" PRIMARY KEY("league_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"match_id" uuid,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leagues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"rules" jsonb NOT NULL,
	"timezone" text DEFAULT 'Africa/Cairo' NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"player_id" uuid,
	"kind" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "links_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "valid_link_kind" CHECK ("links"."kind" in ('invite','view','recovery','player'))
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"creator_id" uuid NOT NULL,
	"format" text NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"rules" jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"result" jsonb,
	"table_name" text DEFAULT 'Café table' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_league_pair" UNIQUE("league_id","id"),
	CONSTRAINT "valid_match_state" CHECK ("matches"."state" in ('draft','active','completed','voided')),
	CONSTRAINT "valid_match_format" CHECK ("matches"."format" in ('singles','teams','ffa3','ffa4'))
);
--> statement-breakpoint
CREATE TABLE "members" (
	"league_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"role" text DEFAULT 'player' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "members_league_id_player_id_pk" PRIMARY KEY("league_id","player_id"),
	CONSTRAINT "valid_role" CHECK ("members"."role" in ('owner','scorekeeper','player'))
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"match_id" uuid NOT NULL,
	"league_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"side_id" uuid NOT NULL,
	CONSTRAINT "participants_match_id_player_id_pk" PRIMARY KEY("match_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"avatar" text DEFAULT 'olive' NOT NULL,
	"access_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_access_hash_unique" UNIQUE("access_hash")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window" integer NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"actor_id" uuid NOT NULL,
	"key" uuid NOT NULL,
	"content_hash" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "requests_actor_id_key_pk" PRIMARY KEY("actor_id","key")
);
--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"scores" jsonb NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"voided" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positive_round_number" CHECK ("rounds"."number" > 0)
);
--> statement-breakpoint
CREATE TABLE "scorers" (
	"match_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	CONSTRAINT "scorers_match_id_player_id_pk" PRIMARY KEY("match_id","player_id")
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"league_id" uuid NOT NULL,
	"name" text NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "season_league_pair" UNIQUE("league_id","id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"player_id" uuid NOT NULL,
	"scope_league_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "sides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "side_match_pair" UNIQUE("match_id","id")
);
--> statement-breakpoint
CREATE TABLE "viewer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"link_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "viewer_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "active_seats" ADD CONSTRAINT "active_seats_league_id_player_id_members_league_id_player_id_fk" FOREIGN KEY ("league_id","player_id") REFERENCES "public"."members"("league_id","player_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "active_seats" ADD CONSTRAINT "active_seats_league_id_match_id_matches_league_id_id_fk" FOREIGN KEY ("league_id","match_id") REFERENCES "public"."matches"("league_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audits" ADD CONSTRAINT "audits_actor_id_players_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leagues" ADD CONSTRAINT "leagues_owner_id_players_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_creator_id_players_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_league_id_season_id_seasons_league_id_id_fk" FOREIGN KEY ("league_id","season_id") REFERENCES "public"."seasons"("league_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_league_id_player_id_members_league_id_player_id_fk" FOREIGN KEY ("league_id","player_id") REFERENCES "public"."members"("league_id","player_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_league_id_match_id_matches_league_id_id_fk" FOREIGN KEY ("league_id","match_id") REFERENCES "public"."matches"("league_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_match_id_side_id_sides_match_id_id_fk" FOREIGN KEY ("match_id","side_id") REFERENCES "public"."sides"("match_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_actor_id_players_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorers" ADD CONSTRAINT "scorers_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scorers" ADD CONSTRAINT "scorers_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_scope_league_id_leagues_id_fk" FOREIGN KEY ("scope_league_id") REFERENCES "public"."leagues"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sides" ADD CONSTRAINT "sides_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewer_sessions" ADD CONSTRAINT "viewer_sessions_link_id_links_id_fk" FOREIGN KEY ("link_id") REFERENCES "public"."links"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_match_idx" ON "audits" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_league_state" ON "matches" USING btree ("league_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "round_number" ON "rounds" USING btree ("match_id","number");--> statement-breakpoint
CREATE INDEX "session_player_idx" ON "sessions" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "side_position" ON "sides" USING btree ("match_id","position");