// Copie les données locales (data/saint-eresia.db + data/uploads/) vers la base Turso et Vercel Blob
// déclarés dans .env (TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, BLOB_READ_WRITE_TOKEN).
// Relançable : les lignes déjà présentes (même id) sont ignorées, les images réécrites à l’identique.
// Les comptes Discord (tables de Better Auth) ne sont pas copiés : chacun se reconnecte sur le nouveau site.
import fs from "node:fs/promises";
import path from "node:path";
import { createClient, type InValue } from "@libsql/client";
import { put } from "@vercel/blob";
import { getMigrations } from "better-auth/db/migration";
import { auth } from "../src/lib/auth";
import { client as target, DATA_DIR, db, prepareSchema, UPLOAD_DIR } from "../src/lib/db";

const FILE_PATTERN = /^[0-9a-f-]{36}\.webp$/;
// Ordre d’insertion : les tables référencées d’abord.
const TABLES = ["patch", "patch_image", "novel", "novel_image", "volume", "chapter", "team_member", "patch_member", "novel_member", "patch_member_role", "news", "activity_log"];
const IMAGE_COLUMNS: [table: string, column: string][] = [
  ["patch_image", "file"],
  ["novel_image", "file"],
  ["team_member", "avatarFile"],
];
const TEXT_COLUMNS: [table: string, column: string][] = [
  ["chapter", "content"],
  ["novel", "synopsis"],
  ["patch", "description"],
];

function requireEnv(name: string) {
  if (!process.env[name]) {
    console.error(`${name} manquant dans .env (voir README, section Déploiement).`);
    process.exit(1);
  }
}

async function copyRows(source: ReturnType<typeof createClient>) {
  for (const table of TABLES) {
    const rs = await source.execute(`SELECT * FROM ${table}`);
    if (rs.rows.length === 0) continue;
    const columns = rs.columns;
    const sql = `INSERT OR IGNORE INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;
    let inserted = 0;
    // Par paquets : les chapitres peuvent être volumineux.
    for (let i = 0; i < rs.rows.length; i += 25) {
      const chunk = rs.rows.slice(i, i + 25);
      const results = await target.batch(
        chunk.map((row) => ({ sql, args: columns.map((_, index) => row[index] as InValue) })),
        "write",
      );
      inserted += results.reduce((sum, result) => sum + result.rowsAffected, 0);
    }
    console.log(`✓ ${table} : ${inserted} ligne(s) ajoutée(s) sur ${rs.rows.length}`);
  }
}

// Nom local d’une image à partir de la valeur en base : « uuid.webp » ou une adresse Blob « …/uploads/uuid.webp ».
function localName(file: string) {
  if (FILE_PATTERN.test(file)) return file;
  const match = /^https?:\/\/.+\/uploads\/([0-9a-f-]{36}\.webp)$/.exec(file);
  return match?.[1] ?? null;
}

// Envoie chaque image locale sur Vercel Blob et garde son adresse en base. Les images déjà sur un autre
// store Blob (ancien projet) sont renvoyées sur le store actuel dès que le fichier existe encore en local.
async function uploadImages() {
  const urls = new Map<string, string>(); // nom local → adresse Blob
  for (const [table, column] of IMAGE_COLUMNS) {
    const rows = await db.prepare(`SELECT id, ${column} AS file FROM ${table}`).all<{ id: number; file: string }>();
    for (const row of rows) {
      const name = localName(row.file);
      if (!name) continue;
      let data: Buffer;
      try {
        data = await fs.readFile(path.join(UPLOAD_DIR, name));
      } catch {
        if (FILE_PATTERN.test(row.file)) console.warn(`  ! ${table} #${row.id} : ${row.file} absent de data/uploads/, ignoré`);
        continue;
      }
      const blob = await put(`uploads/${name}`, data, {
        access: "public",
        contentType: "image/webp",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: 31_536_000,
      });
      urls.set(name, blob.url);
      if (blob.url !== row.file) await db.prepare(`UPDATE ${table} SET ${column} = ? WHERE id = ?`).run(blob.url, row.id);
    }
    console.log(`✓ ${table} : images envoyées`);
  }
  return urls;
}

// Les textes (chapitres, synopsis, descriptions) pointent vers /uploads/<nom> : on les fait pointer vers Blob.
async function rewriteTexts(urls: Map<string, string>) {
  if (urls.size === 0) return;
  for (const [table, column] of TEXT_COLUMNS) {
    const rows = await db
      .prepare(`SELECT id, ${column} AS text FROM ${table} WHERE ${column} LIKE '%/uploads/%'`)
      .all<{ id: number; text: string }>();
    let changed = 0;
    for (const row of rows) {
      // Adresse relative (/uploads/…) ou adresse d’un ancien store Blob (https://…/uploads/…).
      const text = row.text.replace(
        /(?:https?:\/\/[^\s)"']+)?\/uploads\/([0-9a-f-]{36}\.webp)/g,
        (whole, file: string) => urls.get(file) ?? whole,
      );
      if (text === row.text) continue;
      await db.prepare(`UPDATE ${table} SET ${column} = ? WHERE id = ?`).run(text, row.id);
      changed++;
    }
    if (changed) console.log(`✓ ${table}.${column} : ${changed} texte(s) mis à jour`);
  }
}

async function main() {
  requireEnv("TURSO_DATABASE_URL");
  requireEnv("TURSO_AUTH_TOKEN");
  requireEnv("BLOB_READ_WRITE_TOKEN");

  const localDb = path.join(DATA_DIR, "saint-eresia.db");
  await fs.access(localDb).catch(() => {
    console.error(`Base locale introuvable : ${localDb}`);
    process.exit(1);
  });
  const source = createClient({ url: `file:${localDb.replace(/\\/g, "/")}` });

  await prepareSchema(target);
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
  console.log("✓ Tables prêtes sur Turso");

  await copyRows(source);
  const urls = await uploadImages();
  await rewriteTexts(urls);
  console.log("✓ Migration terminée");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
