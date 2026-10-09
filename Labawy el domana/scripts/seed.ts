import "dotenv/config";
import { db, closeDb } from "../src/db";
import { leagues, players, members, seasons, links } from "../src/db/schema";
import { token, hash, linkUrl } from "../src/lib/security";
import { defaultRules } from "../src/lib/domain";
import { createMatch, mutateMatch } from "../src/server/matches";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
const url=new URL(process.env.DATABASE_URL || "postgresql://localhost/unknown");
if(process.env.NODE_ENV==="production" || !url.pathname.endsWith("/domino_dev") || !["localhost","127.0.0.1"].includes(url.hostname)) throw new Error("Seed is allowed only on a localhost database named domino_dev. Production/preview are never seeded.");
try {
 const [existing]=await db().select().from(leagues).where(eq(leagues.name,"The Café Club"));if(existing)throw new Error("Development seed already exists; it will not be reset or duplicated.");
 const access=token(),invite=token(),recover=token();
 const result=await db().transaction(async tx=>{
  const [owner]=await tx.insert(players).values({name:"Karim",avatar:"coffee",accessHash:hash(access)}).returning();
  const [league]=await tx.insert(leagues).values({name:"The Café Club",ownerId:owner.id,rules:defaultRules}).returning();
  const [season]=await tx.insert(seasons).values({leagueId:league.id,name:"Autumn at the café"}).returning();
  await tx.insert(members).values({leagueId:league.id,playerId:owner.id,role:"owner"});
  const friends=[];
  for(const [name,avatar] of [["Alice","olive"],["Bob","amber"],["Carol","rose"],["Dan","sky"],["أحمد","violet"]]){const [p]=await tx.insert(players).values({name,avatar,accessHash:hash(token())}).returning();await tx.insert(members).values({leagueId:league.id,playerId:p.id});friends.push(p.id);}
  await tx.insert(links).values([{leagueId:league.id,kind:"invite",tokenHash:hash(invite),expiresAt:new Date(Date.now()+30*86400000)},{leagueId:league.id,kind:"recovery",tokenHash:hash(recover),expiresAt:new Date(Date.now()+3650*86400000)}]);
  return {owner,league,season,friends};
 });
 const actor={id:result.owner.id,name:result.owner.name,avatar:result.owner.avatar,sessionId:randomUUID(),scopeLeagueId:null};
 const match=await createMatch(actor,{leagueId:result.league.id,seasonId:result.season.id,format:"teams",sides:[result.friends.slice(0,2),result.friends.slice(2,4)],table:"The corner table",key:randomUUID()});
 const base={leagueId:result.league.id,matchId:match.id};
 await mutateMatch(actor,{...base,key:randomUUID(),action:"start",version:0});
 await mutateMatch(actor,{...base,key:randomUUID(),action:"round",scores:[20,10],note:"Opening hand",version:1});
 await mutateMatch(actor,{...base,key:randomUUID(),action:"round",scores:[15,30],version:2});
 await mutateMatch(actor,{...base,key:randomUUID(),action:"finish",version:3});
 const live=await createMatch(actor,{leagueId:result.league.id,seasonId:result.season.id,format:"singles",sides:[[result.friends[0]],[result.friends[4]]],table:"By the window",key:randomUUID()});
 await mutateMatch(actor,{leagueId:result.league.id,matchId:live.id,key:randomUUID(),action:"start",version:0});
 await mutateMatch(actor,{leagueId:result.league.id,matchId:live.id,key:randomUUID(),action:"round",scores:[12,18],version:1});
 console.log("Isolated development sample data created. These links are LOCAL only:");
 console.log("Owner:",linkUrl("access",access));console.log("Invitation:",linkUrl("join",invite));console.log("Owner recovery:",linkUrl("recover",recover));
} finally {await closeDb();}
