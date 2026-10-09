import sharp from "sharp";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { players, members } from "../db/schema";
import { memberFor, type Actor } from "./auth";
import { insist } from "../lib/errors";
export const maxPhotoBytes=3*1024*1024;
export async function savePhoto(actor:Actor,file:File) {
  insist(file.size>0&&file.size<=maxPhotoBytes,400,"Choose a JPEG, PNG, or WebP photo smaller than 3 MB.");
  insist(["image/jpeg","image/png","image/webp"].includes(file.type),400,"Choose a JPEG, PNG, or WebP photo.");
  const input=Buffer.from(await file.arrayBuffer());
  let photo:Buffer;
  try {
    const image=sharp(input,{limitInputPixels:25000000,animated:false});
    const metadata=await image.metadata();
    insist(["jpeg","png","webp"].includes(metadata.format||"")&&(!metadata.pages||metadata.pages===1),400,"Choose a still JPEG, PNG, or WebP photo.");
    // Auto-orient, crop to a square, and re-encode without EXIF/location metadata.
    photo=await image.rotate().resize(512,512,{fit:"cover"}).webp({quality:82}).toBuffer();
  } catch {insist(false,400,"That photo could not be read. Try a smaller JPEG, PNG, or WebP image.");}
  insist(photo.length<=300000,400,"The photo is too complex. Try a smaller or simpler image.");
  await db().update(players).set({photo,photoVersion:sql`${players.photoVersion}+1`}).where(eq(players.id,actor.id));
  return {saved:true};
}
export async function removePhoto(actor:Actor) {await db().update(players).set({photo:null,photoVersion:0}).where(eq(players.id,actor.id));return {saved:true};}
export async function readPhoto(actor:Actor|null,viewer:string|null,leagueId:string,playerId:string) {
  if(viewer!==leagueId)await memberFor(actor,leagueId);
  const [row]=await db().select({photo:players.photo}).from(members).innerJoin(players,eq(players.id,members.playerId)).where(and(eq(members.leagueId,leagueId),eq(members.playerId,playerId)));
  insist(row?.photo,404,"Profile photo not found in this league.");return row.photo;
}
