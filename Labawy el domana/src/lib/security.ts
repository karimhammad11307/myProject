import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
export const token = () => randomBytes(32).toString("base64url");
export const hash = (value:string) => createHash("sha256").update(value).digest("hex");
export function sameHash(a:string,b:string) {const x=Buffer.from(a);const y=Buffer.from(b);return x.length===y.length && timingSafeEqual(x,y);}
export const rateKey = (value:string) => createHmac("sha256",process.env.RATE_LIMIT_SECRET || "local-development-rate-secret").update(value).digest("hex");
export function linkUrl(kind:"access"|"join"|"view"|"recover", raw:string) {return `${(process.env.APP_URL || "http://localhost:3000").replace(/\/$/,"")}/${kind}#${raw}`;}
