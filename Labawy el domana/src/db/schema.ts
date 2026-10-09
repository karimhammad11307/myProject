import { pgTable, customType, uuid, text, timestamp, integer, boolean, jsonb, primaryKey, unique, uniqueIndex, index, foreignKey, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Rules, Format, Outcome } from "../lib/domain";
const bytea = customType<{data:Buffer;driverData:Buffer}>({dataType:()=>"bytea"});
const time = (name: string) => timestamp(name, {withTimezone:true});
export const players = pgTable("players", {
  id: uuid("id").primaryKey().defaultRandom(), name: text("name").notNull(), avatar: text("avatar").notNull().default("olive"),
  accessHash: text("access_hash").notNull().unique(), photo: bytea("photo"), photoVersion: integer("photo_version").notNull().default(0), createdAt: time("created_at").notNull().defaultNow()
});
export const leagues = pgTable("leagues", {
  id: uuid("id").primaryKey().defaultRandom(), name: text("name").notNull(), ownerId: uuid("owner_id").notNull().references(()=>players.id),
  rules: jsonb("rules").$type<Rules>().notNull(), timezone: text("timezone").notNull().default("Africa/Cairo"), version: integer("version").notNull().default(0), createdAt: time("created_at").notNull().defaultNow()
});
export const members = pgTable("members", {
  leagueId: uuid("league_id").notNull().references(()=>leagues.id), playerId: uuid("player_id").notNull().references(()=>players.id),
  role: text("role").$type<"owner"|"scorekeeper"|"player">().notNull().default("player"), archived: boolean("archived").notNull().default(false)
}, t=>[primaryKey({columns:[t.leagueId,t.playerId]}), check("valid_role",sql`${t.role} in ('owner','scorekeeper','player')`)]);
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(), tokenHash: text("token_hash").notNull().unique(), playerId: uuid("player_id").notNull().references(()=>players.id),
  scopeLeagueId: uuid("scope_league_id").references(()=>leagues.id), expiresAt: time("expires_at").notNull(), revokedAt: time("revoked_at"), createdAt: time("created_at").notNull().defaultNow()
},t=>[index("session_player_idx").on(t.playerId)]);
export const seasons = pgTable("seasons", {
  id: uuid("id").primaryKey().defaultRandom(), leagueId: uuid("league_id").notNull().references(()=>leagues.id), name: text("name").notNull(), archived: boolean("archived").notNull().default(false), createdAt: time("created_at").notNull().defaultNow()
},t=>[unique("season_league_pair").on(t.leagueId,t.id)]);
export const links = pgTable("links", {
  id: uuid("id").primaryKey().defaultRandom(), leagueId: uuid("league_id").notNull().references(()=>leagues.id),
  playerId: uuid("player_id").references(()=>players.id), kind: text("kind").$type<"invite"|"view"|"recovery"|"player">().notNull(), tokenHash: text("token_hash").notNull().unique(),
  expiresAt: time("expires_at").notNull(), revokedAt: time("revoked_at"), createdAt: time("created_at").notNull().defaultNow()
},t=>[check("valid_link_kind",sql`${t.kind} in ('invite','view','recovery','player')`)]);
export const viewerSessions = pgTable("viewer_sessions", {
  id: uuid("id").primaryKey().defaultRandom(), tokenHash: text("token_hash").notNull().unique(), linkId: uuid("link_id").notNull().references(()=>links.id), expiresAt: time("expires_at").notNull()
});
export const matches = pgTable("matches", {
  id: uuid("id").primaryKey().defaultRandom(), leagueId: uuid("league_id").notNull().references(()=>leagues.id), seasonId: uuid("season_id").notNull(),
  creatorId: uuid("creator_id").notNull().references(()=>players.id), format: text("format").$type<Format>().notNull(),
  state: text("state").$type<"draft"|"active"|"completed"|"voided">().notNull().default("draft"),
  rules: jsonb("rules").$type<Rules>().notNull(), version: integer("version").notNull().default(0),
  result: jsonb("result").$type<{totals:number[];outcomes:Outcome[]}>(), table: text("table_name").notNull().default("Café table"),
  createdAt: time("created_at").notNull().defaultNow(), startedAt: time("started_at"), completedAt: time("completed_at"), updatedAt: time("updated_at").notNull().defaultNow()
},t=>[unique("match_league_pair").on(t.leagueId,t.id),index("match_league_state").on(t.leagueId,t.state),foreignKey({columns:[t.leagueId,t.seasonId],foreignColumns:[seasons.leagueId,seasons.id]}),check("valid_match_state",sql`${t.state} in ('draft','active','completed','voided')`),check("valid_match_format",sql`${t.format} in ('singles','teams','ffa3','ffa4')`)]);
export const sides = pgTable("sides", {
  id: uuid("id").primaryKey().defaultRandom(), matchId: uuid("match_id").notNull().references(()=>matches.id), position: integer("position").notNull()
},t=>[uniqueIndex("side_position").on(t.matchId,t.position),unique("side_match_pair").on(t.matchId,t.id)]);
export const participants = pgTable("participants", {
  matchId: uuid("match_id").notNull(), leagueId: uuid("league_id").notNull(), playerId: uuid("player_id").notNull(), sideId: uuid("side_id").notNull()
},t=>[primaryKey({columns:[t.matchId,t.playerId]}),foreignKey({columns:[t.leagueId,t.playerId],foreignColumns:[members.leagueId,members.playerId]}),foreignKey({columns:[t.leagueId,t.matchId],foreignColumns:[matches.leagueId,matches.id]}),foreignKey({columns:[t.matchId,t.sideId],foreignColumns:[sides.matchId,sides.id]})]);
export const activeSeats = pgTable("active_seats", {
  leagueId: uuid("league_id").notNull(), playerId: uuid("player_id").notNull(), matchId: uuid("match_id").notNull()
},t=>[primaryKey({columns:[t.leagueId,t.playerId]}),foreignKey({columns:[t.leagueId,t.playerId],foreignColumns:[members.leagueId,members.playerId]}),foreignKey({columns:[t.leagueId,t.matchId],foreignColumns:[matches.leagueId,matches.id]})]);
export const rounds = pgTable("rounds", {
  id: uuid("id").primaryKey().defaultRandom(), matchId: uuid("match_id").notNull().references(()=>matches.id), number: integer("number").notNull(),
  scores: jsonb("scores").$type<number[]>().notNull(), note: text("note").notNull().default(""), voided: boolean("voided").notNull().default(false),
  createdAt: time("created_at").notNull().defaultNow(), updatedAt: time("updated_at").notNull().defaultNow()
},t=>[uniqueIndex("round_number").on(t.matchId,t.number),check("positive_round_number",sql`${t.number} > 0`)]);
export const scorers = pgTable("scorers", {
  matchId: uuid("match_id").notNull().references(()=>matches.id), playerId: uuid("player_id").notNull().references(()=>players.id)
},t=>[primaryKey({columns:[t.matchId,t.playerId]})]);
export const audits = pgTable("audits", {
  id: uuid("id").primaryKey().defaultRandom(), leagueId: uuid("league_id").notNull().references(()=>leagues.id), matchId: uuid("match_id").references(()=>matches.id),
  actorId: uuid("actor_id").notNull().references(()=>players.id), action: text("action").notNull(), before: jsonb("before"), after: jsonb("after"), createdAt: time("created_at").notNull().defaultNow()
},t=>[index("audit_match_idx").on(t.matchId)]);
export const requests = pgTable("requests", {
  actorId: uuid("actor_id").notNull().references(()=>players.id), key: uuid("key").notNull(), contentHash: text("content_hash").notNull(), response: jsonb("response").$type<{id:string}>().notNull(), createdAt: time("created_at").notNull().defaultNow()
},t=>[primaryKey({columns:[t.actorId,t.key]})]);
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(), window: integer("window").notNull(), count: integer("count").notNull().default(1), updatedAt: time("updated_at").notNull().defaultNow()
});
