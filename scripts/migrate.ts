// Crée ou met à jour les tables de la base SQLite (data/saint-eresia.db).
// Les tables des patchs sont créées à l’ouverture de la base ; celles de Better Auth ici.
import { getMigrations } from "better-auth/db/migration";
import { auth } from "../src/lib/auth";

async function main() {
  const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options);
  await runMigrations();
  const changes = toBeCreated.length + toBeAdded.length;
  console.log(changes ? `✓ Base à jour (${changes} modification(s) appliquée(s))` : "✓ Base déjà à jour");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
