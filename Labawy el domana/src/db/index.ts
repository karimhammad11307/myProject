import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
type Database = ReturnType<typeof drizzle<typeof schema>>;
const globalDb = globalThis as unknown as {dominoPool?:Pool;dominoDb?:Database};
export function db(): Database {
  if(!process.env.DATABASE_URL) throw new Error("DATABASE_UNAVAILABLE");
  if(!globalDb.dominoDb) {
    globalDb.dominoPool = new Pool({connectionString:process.env.DATABASE_URL,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:10000});
    globalDb.dominoDb = drizzle(globalDb.dominoPool,{schema});
  }
  return globalDb.dominoDb;
}
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export async function closeDb() {await globalDb.dominoPool?.end(); globalDb.dominoDb=undefined;globalDb.dominoPool=undefined;}
