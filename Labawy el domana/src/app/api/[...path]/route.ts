import { NextRequest, NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { and, eq, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { players, sessions } from "@/db/schema";
import { actorFor, viewerLeague, cookieName, viewerCookieName, cookieOptions, redeemSchema, redeemLink, inspectLink, rateLimit, rotatePrivate } from "@/server/auth";
import { readState } from "@/server/read";
import { createMatchSchema, createMatch, commandSchema, mutateMatch } from "@/server/matches";
import { manageSchema, manage } from "@/server/manage";
import { nameSchema, avatarSchema } from "@/lib/domain";
import { savePhoto, removePhoto, readPhoto, maxPhotoBytes } from "@/server/photos";
import { AppError, insist } from "@/lib/errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
async function handler(req:NextRequest) {
  try {
    const route=req.nextUrl.pathname.replace("/api/","");
    if(req.method==="POST") {
      const origin=req.headers.get("origin");
      insist(origin===req.nextUrl.origin || !!process.env.APP_URL && origin===new URL(process.env.APP_URL).origin,403,"The request must come from this website.");
      insist(Number(req.headers.get("content-length") || 0)<=(route==="profile/photo"?maxPhotoBytes+65536:32768),413,"Request too large.");
    }
    const actor=await actorFor(req.cookies.get(cookieName)?.value);
    if(req.method==="GET") {
      if(route.startsWith("photo/")) {
        const playerId=z.uuid().parse(route.slice(6)),leagueId=z.uuid().parse(req.nextUrl.searchParams.get("league"));
        const photo=await readPhoto(actor,await viewerLeague(req.cookies.get(viewerCookieName)?.value),leagueId,playerId);
        return new NextResponse(new Uint8Array(photo),{headers:{"Content-Type":"image/webp","Content-Disposition":"inline; filename=profile.webp","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
      }
      insist(route==="state",404,"Page not found.");
      const selected=req.nextUrl.searchParams.get("league") || undefined;
      if(selected) z.uuid().parse(selected);
      return json(await readState(actor,selected,await viewerLeague(req.cookies.get(viewerCookieName)?.value)));
    }
    if(route==="profile/photo") {
      insist(actor,401,"Open your private link to upload your profile photo.");await rateLimit(actor.id,"photo",10);
      const form=await req.formData(),file=form.get("photo");insist(file instanceof File,400,"Choose a photo to upload.");
      return json(await savePhoto(actor,file));
    }
    const text=await req.text();insist(text.length<=32768,413,"Request too large.");
    let body:unknown;try {body=JSON.parse(text);} catch {throw new AppError(400,"Invalid request body.");}
    if(route.startsWith("link/")) {
      // Vercel normalizes x-forwarded-for. Local deployments should proxy/normalize it too.
      const ip=(req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();await rateLimit(ip,"access");
      if(route==="link/inspect") {
        const input=z.object({kind:z.enum(["access","join","view","recover"]),token:z.string()}).parse(body);
        return json(await inspectLink(input.kind,input.token));
      }
      insist(route==="link/redeem",404,"Page not found.");
      const result=await redeemLink(redeemSchema.parse(body),actor);
      const response=json({leagueId:result.leagueId,privateLink:result.privateLink,recoveryLink:result.recoveryLink});
      if(result.sessionToken) response.cookies.set(cookieName,result.sessionToken,cookieOptions);
      if(result.viewerToken) response.cookies.set(viewerCookieName,result.viewerToken,{...cookieOptions,maxAge:7*86400});
      return response;
    }
    insist(actor,401,"Your session expired. Open your private link to restore your profile.");
    await rateLimit(actor.id,"mutation",120);
    if(route==="matches") return json(await createMatch(actor,createMatchSchema.parse(body)));
    if(route==="match") return json(await mutateMatch(actor,commandSchema.parse(body)));
    if(route==="manage") return json(await manage(actor,manageSchema.parse(body)));
    if(route==="profile/remove-photo") return json(await removePhoto(actor));
    if(route==="profile") {
      const input=z.object({name:nameSchema,avatar:avatarSchema}).parse(body);
      // Scoped recovery edits the same player's display profile; credentials remain scoped.
      await db().update(players).set(input).where(eq(players.id,actor.id));return json({saved:true});
    }
    if(route==="access/rotate") return json(await rotatePrivate(actor));
    if(route==="access/revoke-others") {
      await db().update(sessions).set({revokedAt:new Date()}).where(and(eq(sessions.playerId,actor.id),ne(sessions.id,actor.sessionId),isNull(sessions.revokedAt),actor.scopeLeagueId?eq(sessions.scopeLeagueId,actor.scopeLeagueId):undefined));return json({saved:true});
    }
    if(route==="access/logout") {
      await db().update(sessions).set({revokedAt:new Date()}).where(eq(sessions.id,actor.sessionId));const response=json({saved:true});response.cookies.set(cookieName,"",{...cookieOptions,maxAge:0});response.cookies.set(viewerCookieName,"",{...cookieOptions,maxAge:0});return response;
    }
    throw new AppError(404,"Page not found.");
  } catch(e) {
    if(e instanceof AppError) return json({error:e.message},e.status);
    if(e instanceof ZodError) return json({error:e.issues.map(i=>i.message).join(" ")},400);
    const code=(e as {code?:string;cause?:{code?:string}}).code || (e as {cause?:{code?:string}}).cause?.code;
    if(code==="23505" || code==="40001" || code==="40P01") return json({error:"Another request changed this data. Refresh and review your draft before retrying."},409);
    // Deliberately never log request bodies or credential-bearing URLs.
    return json({error:"The database is unavailable. Your draft has not been saved. Please retry when the connection returns."},503);
  }
}
export const GET=handler;
export const POST=handler;
