import "server-only";
import { client } from "@/lib/db";
import { zip, type ZipEntry } from "@/lib/zip";

// Sauvegarde de la base au même format que scripts/sauvegarde-db.mjs (branche « sauvegarde-db ») : schema.sql,
// un fichier tables/<table>.jsonl par table (une ligne JSON par enregistrement, triées par rowid) et lignes.json.
// Elle se recharge avec scripts/restaurer-sauvegarde.mjs. Les tables de connexion (comptes Discord, e-mails,
// sessions, jetons) n'en font pas partie : chacun se reconnecte avec Discord après une restauration.
const PRIVATE = new Set(["user", "session", "account", "verification"]);

// Les BLOB (s'il y en a un jour) passent en base64 pour rester dans du texte.
const plain = (value: unknown) =>
  value instanceof ArrayBuffer ? { $blob: Buffer.from(value).toString("base64") } : typeof value === "bigint" ? Number(value) : value;

export async function backupArchive(): Promise<{ data: Buffer; rows: number }> {
  const schema = (
    await client.execute(
      "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type = 'table' DESC, name",
    )
  ).rows.filter((row) => !PRIVATE.has(String(row.tbl_name)));
  const entries: ZipEntry[] = [{ name: "schema.sql", data: schema.map((row) => `${row.sql};`).join("\n\n") + "\n" }];
  const counts: Record<string, number> = {};
  for (const table of schema.filter((row) => row.type === "table").map((row) => String(row.name))) {
    const rs = await client.execute(`SELECT * FROM "${table}" ORDER BY rowid`);
    const lines = rs.rows.map((row) => JSON.stringify(Object.fromEntries(rs.columns.map((column, i) => [column, plain(row[i])]))));
    entries.push({ name: `tables/${table}.jsonl`, data: lines.length ? lines.join("\n") + "\n" : "" });
    counts[table] = lines.length;
  }
  entries.push({ name: "lignes.json", data: JSON.stringify(counts, null, 2) + "\n" });
  return { data: zip(entries), rows: Object.values(counts).reduce((sum, n) => sum + n, 0) };
}

// « saint-eresia-2026-10-23-1405.zip » (heure de Paris).
export function backupFileName(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `saint-eresia-${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}.zip`;
}
