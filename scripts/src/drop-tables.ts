import "./load-env.ts";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Dropping all tables...");
  
  // Drop tables in reverse order of dependencies
  await db.execute(sql`DROP TABLE IF EXISTS "messages" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "practice_sessions" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "conversations" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "scenarios" CASCADE`);
  await db.execute(sql`DROP TABLE IF EXISTS "categories" CASCADE`);
  
  console.log("All tables dropped successfully.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Failed to drop tables:", err);
  process.exit(1);
});
