// Sauvegarde de la base en ligne (Turso) sous forme de fichiers texte : un fichier par table, une ligne JSON par
// enregistrement, triés par rowid pour que git ne montre que ce qui a changé. Les tables de connexion (comptes
// Discord, e-mails, sessions, jetons) ne sont jamais sauvegardées : le dépôt est public.
//   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… node scripts/sauvegarde-db.mjs <dossier>
// Restauration : scripts/restaurer-sauvegarde.mjs.
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";

// Ni les tables de comptage du jour (site_visit, patch_download : empreintes de visiteurs, sans intérêt à restaurer).
const PRIVATE = new Set(["user", "session", "account", "verification", "site_visit", "patch_download"]);
const out = process.argv[2];
if (!out || !process.env.TURSO_DATABASE_URL) {
  console.error("usage : TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… node scripts/sauvegarde-db.mjs <dossier>");
  process.exit(1);
}
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

// Les BLOB (s'il y en a un jour) passent en base64 pour rester dans du texte.
const plain = (v) => (v instanceof ArrayBuffer ? { $blob: Buffer.from(v).toString("base64") } : typeof v === "bigint" ? Number(v) : v);

const schema = (
  await db.execute("SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type = 'table' DESC, name")
).rows.filter((r) => !PRIVATE.has(String(r.tbl_name)));
const tables = schema.filter((r) => r.type === "table").map((r) => String(r.name));

await fs.rm(path.join(out, "tables"), { recursive: true, force: true });
await fs.mkdir(path.join(out, "tables"), { recursive: true });
await fs.writeFile(path.join(out, "schema.sql"), schema.map((r) => `${r.sql};`).join("\n\n") + "\n");

const counts = {};
for (const table of tables) {
  const rs = await db.execute(`SELECT * FROM "${table}" ORDER BY rowid`);
  const lines = rs.rows.map((row) => JSON.stringify(Object.fromEntries(rs.columns.map((c, i) => [c, plain(row[i])]))));
  await fs.writeFile(path.join(out, "tables", `${table}.jsonl`), lines.length ? lines.join("\n") + "\n" : "");
  counts[table] = lines.length;
}
await fs.writeFile(path.join(out, "lignes.json"), JSON.stringify(counts, null, 2) + "\n");
console.log(Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(", "));
