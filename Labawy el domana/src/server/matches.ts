import { and, eq, inArray, sql, asc } from "drizzle-orm";
import { z } from "zod";
import { db, type Tx } from "../db";
import { leagues, seasons, members, matches, sides, participants, activeSeats, rounds, scorers, audits, requests } from "../db/schema";
import { memberFor, type Actor } from "./auth";
import { insist } from "../lib/errors";
import { formats, roundSchema, validateLineup, totalsFor, canFinish, autoFinish, outcomes } from "../lib/domain";
import { hash } from "../lib/security";
const id=z.uuid();
export const createMatchSchema=z.object({leagueId:id,seasonId:id,format:z.enum(formats),sides:z.array(z.array(id)),table:z.string().trim().min(1).max(40).default("Café table"),key:id});
export const commandSchema=z.object({leagueId:id,matchId:id,version:z.number().int().min(0),key:id,action:z.enum(["start","round","revise","undo","finish","reopen","void","grant","lineup"]),roundId:id.optional(),scores:roundSchema.shape.scores.optional(),note:roundSchema.shape.note.optional(),playerId:id.optional(),sides:z.array(z.array(id)).optional()});
async function replay(tx:Tx,actorId:string,key:string,payload:unknown) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${actorId+":"+key},0))`);
  const contentHash=hash(JSON.stringify(payload));
  const [old]=await tx.select().from(requests).where(and(eq(requests.actorId,actorId),eq(requests.key,key)));
  insist(!old || old.contentHash===contentHash,409,"That request key was already used for different content. Review your draft and start a new request.");
  return {old:old?.response,contentHash};
}
async function remember(tx:Tx,actorId:string,key:string,contentHash:string,id:string) {await tx.insert(requests).values({actorId,key,contentHash,response:{id}});return {id};}
async function lockLeague(tx:Tx,leagueId:string) {
  const [league]=await tx.select().from(leagues).where(eq(leagues.id,leagueId)).for("update");insist(league,404,"League not found.");return league;
}
async function validPlayers(tx:Tx,leagueId:string,format:typeof formats[number],lineup:string[][]) {
  try {validateLineup(format,lineup);} catch(e) {insist(false,400,(e as Error).message);}
  const rows=await tx.select().from(members).where(and(eq(members.leagueId,leagueId),inArray(members.playerId,lineup.flat()),eq(members.archived,false)));
  insist(rows.length===lineup.flat().length,400,"Every participant must be an active member of this league.");
}
async function insertLineup(tx:Tx,matchId:string,leagueId:string,lineup:string[][]) {
  for(let i=0;i<lineup.length;i++) {
    const [side]=await tx.insert(sides).values({matchId,position:i}).returning();
    await tx.insert(participants).values(lineup[i].map(playerId=>({matchId,leagueId,playerId,sideId:side.id})));
  }
}
export async function createMatch(actor:Actor,input:z.infer<typeof createMatchSchema>) {
  return db().transaction(async tx=>{
    const league=await lockLeague(tx,input.leagueId), member=await memberFor(actor,input.leagueId,tx);
    insist(member.role!=="player" || input.sides.flat().includes(actor.id),403,"Players can create matches involving themselves.");
    const r=await replay(tx,actor.id,input.key,input);if(r.old) return r.old;
    await validPlayers(tx,input.leagueId,input.format,input.sides);
    const [season]=await tx.select().from(seasons).where(and(eq(seasons.id,input.seasonId),eq(seasons.leagueId,input.leagueId),eq(seasons.archived,false)));
    insist(season,400,"Choose an open season from this league.");
    const [match]=await tx.insert(matches).values({leagueId:input.leagueId,seasonId:input.seasonId,creatorId:actor.id,format:input.format,rules:league.rules,table:input.table}).returning();
    await insertLineup(tx,match.id,input.leagueId,input.sides);
    await tx.insert(audits).values({leagueId:input.leagueId,matchId:match.id,actorId:actor.id,action:"created",after:{format:input.format,sides:input.sides}});
    return remember(tx,actor.id,input.key,r.contentHash,match.id);
  });
}
export async function mutateMatch(actor:Actor,input:z.infer<typeof commandSchema>) {
  return db().transaction(async tx=>{
    const league=await lockLeague(tx,input.leagueId),member=await memberFor(actor,input.leagueId,tx);
    const [m]=await tx.select().from(matches).where(and(eq(matches.id,input.matchId),eq(matches.leagueId,input.leagueId))).for("update");
    insist(m,404,"Match not found in this league.");
    const privileged=member.role==="owner" || member.role==="scorekeeper";
    const [grant]=await tx.select().from(scorers).where(and(eq(scorers.matchId,m.id),eq(scorers.playerId,actor.id)));
    insist(privileged || m.creatorId===actor.id || grant,403,"Only an authorized scorer can change this match.");
    if(input.action==="grant") insist(privileged,403,"Only the owner or a scorekeeper can grant scoring access.");
    const r=await replay(tx,actor.id,input.key,input);if(r.old) return r.old;
    insist(m.version===input.version,409,"This match changed on another device. The latest saved state is shown; review your draft before retrying.");
    const sideRows=await tx.select().from(sides).where(eq(sides.matchId,m.id)).orderBy(asc(sides.position));
    const lineup=await tx.select().from(participants).where(eq(participants.matchId,m.id));
    let scoringRounds=await tx.select().from(rounds).where(eq(rounds.matchId,m.id)).orderBy(asc(rounds.number));
    let state=m.state,rules=m.rules,startedAt=m.startedAt,completedAt=m.completedAt,result=m.result;
    let auditBefore:unknown={state:m.state,version:m.version},auditAfter:unknown;
    if(input.action==="start" || input.action==="reopen") {
      insist(input.action==="start" ? m.state==="draft" : m.state==="completed",409,"This match is not in a state that can be started or reopened.");
      if(input.action==="start") {
        const [season]=await tx.select().from(seasons).where(and(eq(seasons.id,m.seasonId),eq(seasons.archived,false)));
        insist(season,409,"This season is archived. Create a match in an open season.");
        await validPlayers(tx,m.leagueId,m.format,sideRows.map(s=>lineup.filter(p=>p.sideId===s.id).map(p=>p.playerId)));
        rules=league.rules;startedAt=new Date();
      }
      const occupied=await tx.select().from(activeSeats).where(and(eq(activeSeats.leagueId,m.leagueId),inArray(activeSeats.playerId,lineup.map(p=>p.playerId))));
      insist(!occupied.length,409,"A participant is already at another active table. Finish or void that match first.");
      await tx.insert(activeSeats).values(lineup.map(p=>({leagueId:m.leagueId,playerId:p.playerId,matchId:m.id})));
      state="active";result=null;completedAt=null;
    } else if(input.action==="round" || input.action==="revise" || input.action==="undo") {
      insist(m.state==="active",409,"Completed matches are locked. Reopen the match before changing rounds.");
      if(input.action==="undo") {
        const last=scoringRounds.filter(r=>!r.voided).at(-1);insist(last,400,"There is no recorded round to undo.");
        auditBefore=last;await tx.update(rounds).set({voided:true,updatedAt:new Date()}).where(eq(rounds.id,last.id));auditAfter={...last,voided:true};
      } else {
        const entry=roundSchema.parse({scores:input.scores,note:input.note || ""});
        insist(entry.scores.length===sideRows.length,400,"Enter a score for every side, including zero.");
        if(input.action==="round") {
          insist(scoringRounds.length<10000,400,"This match has reached the round limit.");
          const [saved]=await tx.insert(rounds).values({matchId:m.id,number:(scoringRounds.at(-1)?.number || 0)+1,scores:entry.scores,note:entry.note}).returning();auditAfter=saved;
        } else {
          const old=scoringRounds.find(r=>r.id===input.roundId && !r.voided);insist(old,404,"Round not found in this match.");auditBefore=old;
          const [saved]=await tx.update(rounds).set({...entry,updatedAt:new Date()}).where(eq(rounds.id,old.id)).returning();auditAfter=saved;
        }
      }
      scoringRounds=await tx.select().from(rounds).where(eq(rounds.matchId,m.id)).orderBy(asc(rounds.number));
      const total=totalsFor(sideRows.length,scoringRounds);
      if(autoFinish(total,scoringRounds.filter(r=>!r.voided).length,rules)) {state="completed";completedAt=new Date();result={totals:total,outcomes:outcomes(total,rules)};}
    } else if(input.action==="finish") {
      insist(m.state==="active",409,"Only an active match can be completed.");
      const total=totalsFor(sideRows.length,scoringRounds),count=scoringRounds.filter(r=>!r.voided).length;
      insist(canFinish(total,count,rules),400,count ? "The leading score is tied. Record an additional round." : "Record at least one complete round first.");
      insist(rules.completion==="manual" || (rules.completion==="rounds" ? count>=rules.limit : Math.max(...total)>=rules.limit),400,"The configured completion condition has not been reached.");
      state="completed";completedAt=new Date();result={totals:total,outcomes:outcomes(total,rules)};
    } else if(input.action==="void") {
      insist(m.state!=="voided",409,"This match is already voided.");state="voided";result=null;
    } else if(input.action==="grant") {
      insist(input.playerId,400,"Choose a league member.");
      await memberFor({...actor,id:input.playerId},m.leagueId,tx);
      await tx.insert(scorers).values({matchId:m.id,playerId:input.playerId}).onConflictDoNothing();auditAfter={playerId:input.playerId};
    } else if(input.action==="lineup") {
      insist(m.state==="draft" && !scoringRounds.length,409,"Lineups are locked after a match starts.");insist(input.sides,400,"Choose participants.");
      await validPlayers(tx,m.leagueId,m.format,input.sides);
      insist(member.role!=="player" || input.sides.flat().includes(actor.id),403,"Your match must include you.");
      await tx.delete(participants).where(eq(participants.matchId,m.id));await tx.delete(sides).where(eq(sides.matchId,m.id));
      await insertLineup(tx,m.id,m.leagueId,input.sides);auditAfter={sides:input.sides};
    }
    if(state==="completed" || state==="voided") await tx.delete(activeSeats).where(eq(activeSeats.matchId,m.id));
    await tx.update(matches).set({state,rules,startedAt,completedAt,result,version:m.version+1,updatedAt:new Date()}).where(eq(matches.id,m.id));
    await tx.insert(audits).values({leagueId:m.leagueId,matchId:m.id,actorId:actor.id,action:input.action,before:auditBefore,after:auditAfter || {state,version:m.version+1,result}});
    return remember(tx,actor.id,input.key,r.contentHash,m.id);
  });
}
