import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db, type Tx } from "../db";
import { players, sessions, members, leagues, links, viewerSessions } from "../db/schema";
import { token, hash, rateKey, linkUrl } from "../lib/security";
import { insist, AppError } from "../lib/errors";
import { nameSchema, avatarSchema } from "../lib/domain";
import { z } from "zod";
export const cookieName = process.env.NODE_ENV === "production" ? "__Host-domino" : "domino";
export const viewerCookieName = process.env.NODE_ENV === "production" ? "__Host-domino-view" : "domino-view";
export const cookieOptions = {httpOnly:true,secure:process.env.NODE_ENV === "production",sameSite:"lax" as const,path:"/",maxAge:60*60*24*90};
export type Actor = {id:string;name:string;avatar:string;sessionId:string;scopeLeagueId:string|null};
export async function actorFor(raw?:string): Promise<Actor|null> {
  if(!raw || raw.length>100) return null;
  const [row] = await db().select({id:players.id,name:players.name,avatar:players.avatar,sessionId:sessions.id,scopeLeagueId:sessions.scopeLeagueId}).from(sessions).innerJoin(players,eq(players.id,sessions.playerId)).where(and(eq(sessions.tokenHash,hash(raw)),isNull(sessions.revokedAt),gt(sessions.expiresAt,new Date())));
  return row || null;
}
export async function memberFor(actor:Actor|null, leagueId:string, tx:Tx|ReturnType<typeof db>=db()) {
  insist(actor,401,"Your session expired. Open your private link to restore your profile.");
  insist(!actor.scopeLeagueId || actor.scopeLeagueId===leagueId,403,"This recovery session belongs to a different league.");
  const [membership] = await tx.select().from(members).where(and(eq(members.leagueId,leagueId),eq(members.playerId,actor.id)));
  insist(membership && !membership.archived,403,"You do not have access to this league.");
  return membership;
}
export async function viewerLeague(raw?:string) {
  if(!raw || raw.length>100) return null;
  const [row]=await db().select({leagueId:links.leagueId}).from(viewerSessions).innerJoin(links,eq(links.id,viewerSessions.linkId)).where(and(eq(viewerSessions.tokenHash,hash(raw)),gt(viewerSessions.expiresAt,new Date()),gt(links.expiresAt,new Date()),isNull(links.revokedAt),eq(links.kind,"view")));
  return row?.leagueId || null;
}
export async function rateLimit(ip:string, action:string, maximum=30) {
  if(process.env.NODE_ENV === "production") insist(process.env.RATE_LIMIT_SECRET && process.env.RATE_LIMIT_SECRET.length>=32,503,"Access protection is not configured. Contact the deployment owner.");
  const key=rateKey(`${action}:${ip}`), window=Math.floor(Date.now()/60000);
  const result=await db().execute(sql`INSERT INTO rate_limits (key, "window", count) VALUES (${key},${window},1) ON CONFLICT (key) DO UPDATE SET count=CASE WHEN rate_limits."window"=${window} THEN rate_limits.count+1 ELSE 1 END,"window"=${window},updated_at=now() RETURNING count`);
  if(Number(result.rows[0].count)>maximum) throw new AppError(429,"Too many attempts. Please wait a minute and retry.");
}
const rawSchema=z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const redeemSchema=z.object({kind:z.enum(["access","join","view","recover"]),token:rawSchema,name:nameSchema.optional(),avatar:avatarSchema.default("olive"),confirmSwitch:z.boolean().default(false)});
export async function inspectLink(kind:string, raw:string) {
  rawSchema.parse(raw);
  if(kind==="access") {
    const [p]=await db().select({id:players.id,name:players.name,avatar:players.avatar}).from(players).where(eq(players.accessHash,hash(raw)));
    if(p) return {kind,name:p.name,playerId:p.id};
    const [scoped]=await db().select({name:players.name,playerId:players.id,leagueName:leagues.name}).from(links).innerJoin(players,eq(players.id,links.playerId)).innerJoin(leagues,eq(leagues.id,links.leagueId)).where(and(eq(links.tokenHash,hash(raw)),eq(links.kind,"player"),isNull(links.revokedAt),gt(links.expiresAt,new Date())));
    insist(scoped,404,"This private link is invalid, expired, or has been replaced."); return {kind,...scoped};
  }
  const expected=kind==="join"?"invite":kind==="view"?"view":"recovery";
  const [row]=await db().select({id:links.id,leagueName:leagues.name}).from(links).innerJoin(leagues,eq(leagues.id,links.leagueId)).where(and(eq(links.tokenHash,hash(raw)),eq(links.kind,expected),isNull(links.revokedAt),gt(links.expiresAt,new Date())));
  insist(row,404,"This link is invalid, expired, or revoked."); return {kind,leagueName:row.leagueName};
}
async function makeSession(tx:Tx, playerId:string, scopeLeagueId:string|null=null) {
  const raw=token(); await tx.insert(sessions).values({tokenHash:hash(raw),playerId,scopeLeagueId,expiresAt:new Date(Date.now()+90*86400000)});return raw;
}
export async function redeemLink(input:z.infer<typeof redeemSchema>, current:Actor|null) {
  return db().transaction(async tx=>{
    let playerId:string|undefined, leagueId:string|undefined, scope:string|null=null;
    let privateLink:string|undefined, recoveryLink:string|undefined;
    if(input.kind==="access") {
      const [p]=await tx.select().from(players).where(eq(players.accessHash,hash(input.token))).for("update");
      if(p) playerId=p.id;
      else {
        const [l]=await tx.select().from(links).where(and(eq(links.tokenHash,hash(input.token)),eq(links.kind,"player"),isNull(links.revokedAt),gt(links.expiresAt,new Date()))).for("update");
        insist(l?.playerId,404,"This private link is invalid, expired, or has been replaced.");playerId=l.playerId;scope=l.leagueId;leagueId=l.leagueId;
      }
    } else {
      const expected=input.kind==="join"?"invite":input.kind==="view"?"view":"recovery";
      const [l]=await tx.select().from(links).where(and(eq(links.tokenHash,hash(input.token)),eq(links.kind,expected),isNull(links.revokedAt),gt(links.expiresAt,new Date()))).for("update");
      insist(l,404,"This link is invalid, expired, or revoked.");leagueId=l.leagueId;
      if(input.kind==="view") {
        const raw=token();await tx.insert(viewerSessions).values({tokenHash:hash(raw),linkId:l.id,expiresAt:new Date(Math.min(l.expiresAt.getTime(),Date.now()+7*86400000))});
        return {viewerToken:raw,leagueId};
      }
      if(input.kind==="recover") {
        const [league]=await tx.select().from(leagues).where(eq(leagues.id,l.leagueId)).for("update");playerId=league.ownerId;
        insist(!current || current.id===playerId || input.confirmSwitch,409,"Confirm switching from the current player before restoring the owner.");
        const access=token();await tx.update(players).set({accessHash:hash(access)}).where(eq(players.id,playerId));
        await tx.update(sessions).set({revokedAt:new Date()}).where(eq(sessions.playerId,playerId));
        await tx.update(links).set({revokedAt:new Date()}).where(and(eq(links.leagueId,l.leagueId),eq(links.kind,"recovery")));
        const next=token();await tx.insert(links).values({leagueId:l.leagueId,kind:"recovery",tokenHash:hash(next),expiresAt:new Date(Date.now()+3650*86400000)});
        privateLink=linkUrl("access",access);recoveryLink=linkUrl("recover",next);
      } else {
        if(current) {
          insist(!current.scopeLeagueId || current.scopeLeagueId===leagueId,403,"Use your full private profile link to join another league.");playerId=current.id;
        } else {
          insist(input.name,400,"Enter your display name.");
          const access=token();const [p]=await tx.insert(players).values({name:input.name,avatar:input.avatar,accessHash:hash(access)}).returning();playerId=p.id;privateLink=linkUrl("access",access);
        }
        const [existing]=await tx.select().from(members).where(and(eq(members.leagueId,leagueId),eq(members.playerId,playerId)));
        insist(!existing?.archived,403,"Your membership is archived. Ask the owner to restore it.");
        await tx.insert(members).values({leagueId,playerId,role:"player"}).onConflictDoNothing();
      }
    }
    insist(playerId,400,"Unable to restore this profile.");
    insist(!current || current.id===playerId || input.confirmSwitch,409,"Confirm switching from the current player before continuing.");
    if(current && current.id!==playerId) await tx.update(sessions).set({revokedAt:new Date()}).where(eq(sessions.id,current.sessionId));
    if(current && current.id===playerId && input.kind==="join") return {leagueId,privateLink};
    const sessionToken=await makeSession(tx,playerId,scope);
    return {sessionToken,leagueId,privateLink,recoveryLink};
  });
}
export async function rotatePrivate(actor:Actor) {
  return db().transaction(async tx=>{
    const raw=token();
    if(actor.scopeLeagueId) {
      await memberFor(actor,actor.scopeLeagueId,tx);
      await tx.update(links).set({revokedAt:new Date()}).where(and(eq(links.leagueId,actor.scopeLeagueId),eq(links.playerId,actor.id),eq(links.kind,"player")));
      await tx.insert(links).values({leagueId:actor.scopeLeagueId,playerId:actor.id,kind:"player",tokenHash:hash(raw),expiresAt:new Date(Date.now()+3650*86400000)});
    } else await tx.update(players).set({accessHash:hash(raw)}).where(eq(players.id,actor.id));
    return {privateLink:linkUrl("access",raw)};
  });
}
