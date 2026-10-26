// Recharge une sauvegarde faite par scripts/sauvegarde-db.mjs (branche « sauvegarde-db ») dans une base :
// crée les tables manquantes, puis remplace chaque enregistrement sauvegardé (même id). Les lignes absentes de la
// sauvegarde ne sont pas supprimées. Les comptes ne sont pas dans la sauvegarde : chacun se reconnecte avec Discord.
//   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… node scripts/restaurer-sauvegarde.mjs <dossier>
//   (ou TURSO_DATABASE_URL=file:data/restauree.db pour une copie locale)
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@libsql/client";

const dir = process.argv[2];
if (!dir || !process.env.TURSO_DATABASE_URL) {
  console.error("usage : TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… node scripts/restaurer-sauvegarde.mjs <dossier>");
  process.exit(1);
}
const db = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

const value = (v) => (v && typeof v === "object" && "$blob" in v ? Buffer.from(v.$blob, "base64") : v);

const schema = await fs.readFile(path.join(dir, "schema.sql"), "utf8");
const statements = schema
  .split(/;\n\n/)
  .map((s) => s.replace(/;\s*$/, "").trim())
  .filter(Boolean)
  .map((s) => s.replace(/^CREATE (TABLE|INDEX|UNIQUE INDEX|TRIGGER|VIEW) (?!IF NOT EXISTS)/, "CREATE $1 IF NOT EXISTS "));
for (const sql of statements) await db.execute(sql);

// Les tables référencées d'abord (clés étrangères), d'après les REFERENCES du schéma.
const deps = new Map();
for (const sql of statements.filter((s) => /^CREATE TABLE/.test(s))) {
  const name = /^CREATE TABLE IF NOT EXISTS "?(\w+)"?/.exec(sql)?.[1];
  if (name) deps.set(name, [...sql.matchAll(/REFERENCES "?(\w+)"?/g)].map((m) => m[1]).filter((t) => t !== name));
}
const order = [];
const visit = (t) => {
  if (order.includes(t)) return;
  for (const d of deps.get(t) ?? []) if (deps.has(d)) visit(d);
  order.push(t);
};
for (const t of deps.keys()) visit(t);

for (const table of order) {
  const file = path.join(dir, "tables", `${table}.jsonl`);
  const text = await fs.readFile(file, "utf8").catch(() => null);
  if (text === null) continue;
  const rows = text.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  // Mise à jour sur place (pas INSERT OR REPLACE, qui supprimerait d'abord la ligne et ses dépendances en cascade).
  const pk = (await db.execute(`PRAGMA table_info("${table}")`)).rows.filter((r) => Number(r.pk) > 0).map((r) => String(r.name));
  for (let i = 0; i < rows.length; i += 25) {
    await db.batch(
      rows.slice(i, i + 25).map((row) => {
        const cols = Object.keys(row);
        const rest = cols.filter((c) => !pk.includes(c));
        const upsert = pk.length && rest.length ? ` ON CONFLICT (${pk.map((c) => `"${c}"`).join(", ")}) DO UPDATE SET ${rest.map((c) => `"${c}" = excluded."${c}"`).join(", ")}` : pk.length ? " ON CONFLICT DO NOTHING" : "";
        return {
          sql: `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) VALUES (${cols.map(() => "?").join(", ")})${upsert}`,
          args: cols.map((c) => value(row[c])),
        };
      }),
      "write",
    );
  }
  console.log(`${table} : ${rows.length}`);
}
