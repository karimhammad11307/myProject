import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
const connectionString=process.env.DIRECT_URL || process.env.DATABASE_URL;
if(!connectionString) throw new Error("Set DIRECT_URL (direct PostgreSQL connection) before running migrations.");
const pool=new Pool({connectionString,max:1});
try {await migrate(drizzle(pool),{migrationsFolder:"drizzle"});console.log("Versioned database migrations applied.");} finally {await pool.end();}
