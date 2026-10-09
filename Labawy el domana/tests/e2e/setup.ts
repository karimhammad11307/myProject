import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, closeDb } from "../../src/db";
export default async function setup(){if(!process.env.DATABASE_URL || !new URL(process.env.DATABASE_URL).pathname.includes("test"))throw new Error("Test database required.");try{await migrate(db(),{migrationsFolder:"drizzle"});}finally{await closeDb();}}
