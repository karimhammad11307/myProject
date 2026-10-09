import { and, eq, asc, desc, inArray } from "drizzle-orm";
import { db } from "../db";
import { leagues, members, players, seasons, matches, sides, participants, rounds, scorers, audits, links } from "../db/schema";
import { memberFor, type Actor } from "./auth";
import type { State, MatchView } from "../lib/types";
import { insist } from "../lib/errors";
export async function readState(actor:Actor|null,selected?:string,viewer?:string|null):Promise<State> {
  return db().transaction(async tx=>{
    let leagueList=actor ? await tx.select({id:leagues.id,name:leagues.name}).from(members).innerJoin(leagues,eq(leagues.id,members.leagueId)).where(and(eq(members.playerId,actor.id),eq(members.archived,false),actor.scopeLeagueId ? eq(leagues.id,actor.scopeLeagueId):undefined)).orderBy(asc(leagues.createdAt)) : [];
    const leagueId=selected || leagueList[0]?.id || viewer;
    const base:State={actor:actor?{id:actor.id,name:actor.name,avatar:actor.avatar,scopeLeagueId:actor.scopeLeagueId}:null,leagues:leagueList,league:null,role:null,readOnly:false,players:[],seasons:[],matches:[],links:[],updatedAt:new Date().toISOString()};
    if(!leagueId) return base;
    let role:string|null=null;
    if(actor && leagueList.some(l=>l.id===leagueId)) role=(await memberFor(actor,leagueId,tx)).role;
    else insist(viewer===leagueId,actor?403:401,actor?"You do not have access to this league.":"Open your invitation, private profile, or read-only league link.");
    const [league]=await tx.select({id:leagues.id,name:leagues.name,ownerId:leagues.ownerId,rules:leagues.rules,timezone:leagues.timezone,version:leagues.version}).from(leagues).where(eq(leagues.id,leagueId));insist(league,404,"League not found.");
    if(!leagueList.length) leagueList=[{id:league.id,name:league.name}];
    const playerRows=await tx.select({id:players.id,name:players.name,avatar:players.avatar,photoVersion:players.photoVersion,role:members.role,archived:members.archived}).from(members).innerJoin(players,eq(players.id,members.playerId)).where(eq(members.leagueId,leagueId)).orderBy(asc(players.name));
    const seasonRows=await tx.select({id:seasons.id,name:seasons.name,archived:seasons.archived}).from(seasons).where(eq(seasons.leagueId,leagueId)).orderBy(desc(seasons.createdAt));
    const matchRows=await tx.select().from(matches).where(eq(matches.leagueId,leagueId)).orderBy(desc(matches.createdAt));
    const ids=matchRows.map(m=>m.id);
    const sideRows=ids.length?await tx.select().from(sides).where(inArray(sides.matchId,ids)).orderBy(asc(sides.position)):[];
    const participantRows=await tx.select().from(participants).where(eq(participants.leagueId,leagueId));
    const roundRows=ids.length?await tx.select().from(rounds).where(inArray(rounds.matchId,ids)).orderBy(asc(rounds.number)):[];
    const scorerRows=ids.length?await tx.select().from(scorers).where(inArray(scorers.matchId,ids)):[];
    const auditRows=await tx.select().from(audits).where(eq(audits.leagueId,leagueId)).orderBy(desc(audits.createdAt));
    const matchViews:MatchView[]=matchRows.map(m=>({
      ...m,createdAt:m.createdAt.toISOString(),updatedAt:m.updatedAt.toISOString(),startedAt:m.startedAt?.toISOString() || null,completedAt:m.completedAt?.toISOString() || null,
      sides:sideRows.filter(s=>s.matchId===m.id).map(s=>({id:s.id,position:s.position,players:participantRows.filter(p=>p.sideId===s.id).map(p=>p.playerId)})),
      rounds:roundRows.filter(r=>r.matchId===m.id).map(r=>({...r,createdAt:r.createdAt.toISOString(),updatedAt:r.updatedAt.toISOString()})),
      canScore:!!role && !!actor && (role==="owner" || role==="scorekeeper" || m.creatorId===actor.id || scorerRows.some(s=>s.matchId===m.id && s.playerId===actor.id)),
      scorers:scorerRows.filter(s=>s.matchId===m.id).map(s=>s.playerId),
      audits:auditRows.filter(a=>a.matchId===m.id).map(a=>({...a,createdAt:a.createdAt.toISOString()}))
    }));
    const linkRows=role==="owner" && !actor?.scopeLeagueId ? await tx.select({id:links.id,kind:links.kind,expiresAt:links.expiresAt,revokedAt:links.revokedAt,playerId:links.playerId}).from(links).where(eq(links.leagueId,leagueId)).orderBy(desc(links.createdAt)):[];
    return {...base,leagues:leagueList,league,role,readOnly:!role,players:playerRows.map(p=>({...p,photoUrl:p.photoVersion?`/api/photo/${p.id}?league=${leagueId}&v=${p.photoVersion}`:null})),actor:actor?{id:actor.id,name:actor.name,avatar:actor.avatar,scopeLeagueId:actor.scopeLeagueId,photoUrl:playerRows.find(p=>p.id===actor.id)?.photoVersion?`/api/photo/${actor.id}?league=${leagueId}&v=${playerRows.find(p=>p.id===actor.id)!.photoVersion}`:null}:null,seasons:seasonRows,matches:matchViews,links:linkRows.map(l=>({...l,expiresAt:l.expiresAt.toISOString(),revokedAt:l.revokedAt?.toISOString()||null}))};
  },{isolationLevel:"repeatable read",accessMode:"read only"});
}
