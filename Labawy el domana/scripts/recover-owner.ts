import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db, closeDb } from "../src/db";
import { players, leagues, links, sessions, audits } from "../src/db/schema";
import { token, hash, linkUrl } from "../src/lib/security";
const leagueId=z.uuid().parse(process.argv[2]);
try {
 const result=await db().transaction(async tx=>{
  const [league]=await tx.select().from(leagues).where(eq(leagues.id,leagueId)).for("update");if(!league)throw new Error("Existing league not found. No owner can be claimed publicly.");
  const access=token(),recovery=token();await tx.update(players).set({accessHash:hash(access)}).where(eq(players.id,league.ownerId));
  await tx.update(sessions).set({revokedAt:new Date()}).where(eq(sessions.playerId,league.ownerId));
  await tx.update(links).set({revokedAt:new Date()}).where(and(eq(links.leagueId,leagueId),eq(links.kind,"recovery")));
  await tx.insert(links).values({leagueId,kind:"recovery",tokenHash:hash(recovery),expiresAt:new Date(Date.now()+3650*86400000)});
  await tx.insert(audits).values({leagueId,actorId:league.ownerId,action:"deployment_owner_recovery"});
  return {access:linkUrl("access",access),recovery:linkUrl("recover",recovery)};
 });
 console.log("New PRIVATE owner access (save securely):",result.access);console.log("New SEPARATE offline recovery:",result.recovery);
 console.log("Old owner access/recovery links and sessions were revoked. Run this only in a private operator terminal.");
} finally {await closeDb();}
