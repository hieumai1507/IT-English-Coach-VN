import { db, scenariosTable } from "@workspace/db";

async function main() {
  const scenarios = await db.select({ id: scenariosTable.id }).from(scenariosTable).limit(5);
  console.log("Current IDs in DB:");
  scenarios.forEach(s => console.log(`${s.id} (length: ${s.id.length})`));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
