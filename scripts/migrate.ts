// Crée ou met à jour les tables de la base : data/saint-eresia.db en local,
// ou la base Turso si TURSO_DATABASE_URL est défini (.env / .env.local).
// Tables du contenu (src/lib/db.ts) puis celles de Better Auth.
import { getMigrations } from "better-auth/db/migration";
import { auth } from "../src/lib/auth";
import { client, prepareSchema } from "../src/lib/db";

async function main() {
  await prepareSchema(client);
  const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);
  await runMigrations();
  const changes = toBeCreated.length + toBeAdded.length;
  console.log(changes ? `✓ Base à jour (${changes} modification(s) appliquée(s))` : "✓ Base déjà à jour");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
