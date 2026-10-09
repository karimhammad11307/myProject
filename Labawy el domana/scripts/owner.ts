import "dotenv/config";
import { db, closeDb } from "../src/db";
import { players, leagues, members, seasons, links } from "../src/db/schema";
import { defaultRules, nameSchema } from "../src/lib/domain";
import { token, hash, linkUrl } from "../src/lib/security";
const [, , leagueArg, ownerArg]=process.argv;
if(!leagueArg || !ownerArg) throw new Error('Usage: npm run owner:setup -- "League name" "Owner display name"');
const name=nameSchema.parse(leagueArg),ownerName=nameSchema.parse(ownerArg);
if(process.env.NODE_ENV==="production" && !process.env.APP_URL?.startsWith("https://")) throw new Error("Set the production HTTPS APP_URL first.");
try {
  const result=await db().transaction(async tx=>{
    const access=token(),recover=token(),invite=token();
    const [owner]=await tx.insert(players).values({name:ownerName,avatar:"coffee",accessHash:hash(access)}).returning();
    const [league]=await tx.insert(leagues).values({name,ownerId:owner.id,rules:defaultRules}).returning();
    await tx.insert(members).values({leagueId:league.id,playerId:owner.id,role:"owner"});
    await tx.insert(seasons).values({leagueId:league.id,name:"Season 1"});
    await tx.insert(links).values([{leagueId:league.id,kind:"recovery",tokenHash:hash(recover),expiresAt:new Date(Date.now()+3650*86400000)},{leagueId:league.id,kind:"invite",tokenHash:hash(invite),expiresAt:new Date(Date.now()+30*86400000)}]);
    return {id:league.id,access:linkUrl("access",access),recover:linkUrl("recover",recover),invite:linkUrl("join",invite)};
  });
  console.log("New league created:",result.id);
  console.log("PRIVATE owner access (save securely):",result.access);
  console.log("SEPARATE owner recovery (save offline):",result.recover);
  console.log("Shared invitation (expires in 30 days):",result.invite);
  console.log("These raw credentials are shown only now. Never paste them into public logs or issue trackers.");
} finally {await closeDb();}
