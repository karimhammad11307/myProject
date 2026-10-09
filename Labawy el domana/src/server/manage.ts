import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { leagues, members, seasons, links, sessions, activeSeats, audits } from "../db/schema";
import { memberFor, type Actor } from "./auth";
import { nameSchema, rulesSchema } from "../lib/domain";
import { token, hash, linkUrl } from "../lib/security";
import { insist } from "../lib/errors";
export const manageSchema=z.object({leagueId:z.uuid(),action:z.enum(["settings","season","archiveSeason","member","link","revokeLink","recoverPlayer"]),name:nameSchema.optional(),timezone:z.string().max(80).optional(),rules:rulesSchema.optional(),version:z.number().int().min(0).optional(),seasonId:z.uuid().optional(),playerId:z.uuid().optional(),role:z.enum(["scorekeeper","player"]).optional(),archived:z.boolean().optional(),kind:z.enum(["invite","view","recovery"]).optional(),linkId:z.uuid().optional()});
export async function manage(actor:Actor,input:z.infer<typeof manageSchema>) {
  return db().transaction(async tx=>{
    const [league]=await tx.select().from(leagues).where(eq(leagues.id,input.leagueId)).for("update");insist(league,404,"League not found.");
    const member=await memberFor(actor,input.leagueId,tx);insist(member.role==="owner" && league.ownerId===actor.id && !actor.scopeLeagueId,403,"Only the league owner can manage access and settings.");
    let response: {url?:string;id?:string}={};
    if(input.action==="settings") {
      insist(input.version===league.version,409,"Settings changed on another device. Refresh and review them.");
      insist(input.name && input.rules && input.timezone,400,"Enter league name, timezone, and scoring rules.");
      try {new Intl.DateTimeFormat("en",{timeZone:input.timezone}).format();} catch {insist(false,400,"Choose a valid IANA timezone, such as Africa/Cairo.");}
      await tx.update(leagues).set({name:input.name,rules:input.rules,timezone:input.timezone,version:league.version+1}).where(eq(leagues.id,input.leagueId));
    } else if(input.action==="season") {
      insist(input.name,400,"Enter a season name.");const [season]=await tx.insert(seasons).values({leagueId:input.leagueId,name:input.name}).returning();response={id:season.id};
    } else if(input.action==="archiveSeason") {
      insist(input.seasonId && typeof input.archived==="boolean",400,"Choose a season and its archive status.");
      const [season]=await tx.update(seasons).set({archived:input.archived}).where(and(eq(seasons.id,input.seasonId),eq(seasons.leagueId,input.leagueId))).returning();insist(season,404,"Season not found in this league.");
    } else if(input.action==="member" || input.action==="recoverPlayer") {
      insist(input.playerId && input.playerId!==league.ownerId,400,"The owner cannot be changed or recovered through player management.");
      const [target]=await tx.select().from(members).where(and(eq(members.leagueId,input.leagueId),eq(members.playerId,input.playerId)));insist(target,404,"Member not found in this league.");
      if(input.action==="member") {
        if(input.archived) {const [seat]=await tx.select().from(activeSeats).where(and(eq(activeSeats.leagueId,input.leagueId),eq(activeSeats.playerId,input.playerId)));insist(!seat,409,"Finish or void this player's active match before archiving them.");}
        await tx.update(members).set({role:input.role || target.role,archived:input.archived ?? target.archived}).where(and(eq(members.leagueId,input.leagueId),eq(members.playerId,input.playerId)));
      } else {
        insist(!target.archived,400,"Restore this membership before recovery.");
        // Recovery credentials authenticate only this league, never other memberships.
        await tx.update(links).set({revokedAt:new Date()}).where(and(eq(links.leagueId,input.leagueId),eq(links.playerId,input.playerId),eq(links.kind,"player")));
        await tx.update(sessions).set({revokedAt:new Date()}).where(and(eq(sessions.playerId,input.playerId),eq(sessions.scopeLeagueId,input.leagueId)));
        const raw=token();await tx.insert(links).values({leagueId:input.leagueId,playerId:input.playerId,kind:"player",tokenHash:hash(raw),expiresAt:new Date(Date.now()+3650*86400000)});response={url:linkUrl("access",raw)};
      }
    } else if(input.action==="link") {
      insist(input.kind,400,"Choose an invitation, read-only, or owner recovery link.");
      if(input.kind==="recovery") await tx.update(links).set({revokedAt:new Date()}).where(and(eq(links.leagueId,input.leagueId),eq(links.kind,"recovery")));
      const raw=token();const [link]=await tx.insert(links).values({leagueId:input.leagueId,kind:input.kind,tokenHash:hash(raw),expiresAt:new Date(Date.now()+(input.kind==="recovery"?3650:30)*86400000)}).returning();
      response={id:link.id,url:linkUrl(input.kind==="invite"?"join":input.kind==="view"?"view":"recover",raw)};
    } else {
      insist(input.linkId,400,"Choose a link to revoke.");const [l]=await tx.update(links).set({revokedAt:new Date()}).where(and(eq(links.id,input.linkId),eq(links.leagueId,input.leagueId))).returning();insist(l,404,"Link not found in this league.");
    }
    // Never persist or log raw credentials, even inside audit records.
    await tx.insert(audits).values({leagueId:input.leagueId,actorId:actor.id,action:input.action,after:{playerId:input.playerId,kind:input.kind,seasonId:input.seasonId,role:input.role,archived:input.archived}});
    await tx.execute(sql`DELETE FROM rate_limits WHERE updated_at < now() - interval '2 days'`);
    return response;
  });
}
