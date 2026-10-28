import "server-only";
import type { InStatement } from "@libsql/client";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import sharp from "sharp";
import { db, UPLOAD_DIR } from "@/lib/db";

export { fileUrl } from "@/lib/file-url";

export const FILE_PATTERN = /^[0-9a-f-]{36}\.webp$/;
const MAX_WIDTH = { cover: 1600, screenshot: 2560, illustration: 2000, background: 2560, logo: 1200 } as const;
export type ImageKind = keyof typeof MAX_WIDTH;
// Types d’image uniques par propriétaire : la nouvelle remplace l’ancienne.
export const SINGLE_KINDS: readonly ImageKind[] = ["cover", "background", "logo"];

// Taille maximale d’un envoi. Sur Vercel, le corps d’une requête est limité à 4,5 Mo.
export const MAX_UPLOAD_MB = process.env.VERCEL ? 4 : 25;

// Une image appartient à un patch (patch_image) ou à un roman (novel_image).
export type ImageOwner = { type: "patch" | "novel"; id: number };
const TABLES = {
  patch: { table: "patch_image", column: "patchId" },
  novel: { table: "novel_image", column: "novelId" },
} as const;

// Stockage : Vercel Blob dès que BLOB_READ_WRITE_TOKEN est défini (la valeur gardée en base est alors
// l’adresse publique du fichier), sinon data/uploads/ en local (valeur gardée : le nom du fichier).
const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export async function storeFile(data: Buffer): Promise<string> {
  const file = `${randomUUID()}.webp`;
  if (blobEnabled()) {
    const blob = await put(`uploads/${file}`, data, {
      access: "public",
      contentType: "image/webp",
      addRandomSuffix: false,
      cacheControlMaxAge: 31_536_000,
    });
    return blob.url;
  }
  if (process.env.VERCEL) throw new Error("BLOB_READ_WRITE_TOKEN manquant : sur Vercel, les images doivent aller sur Vercel Blob.");
  await fs.writeFile(path.join(UPLOAD_DIR, file), data);
  return file;
}

// Libellés des types d’image (journal d’activité, gestion).
export const IMAGE_KIND_LABELS: Record<ImageKind, string> = {
  cover: "Couverture",
  screenshot: "Capture d’écran",
  illustration: "Illustration",
  background: "Arrière-plan",
  logo: "Logo",
};

// Convertit l’image en WebP, l’enregistre et l’ajoute à son propriétaire. `extra` : instructions exécutées
// dans la même transaction que l’ajout (date de mise à jour, journal d’activité…).
export async function saveImage(owner: ImageOwner, kind: ImageKind, input: Buffer, alt: string, extra: InStatement[] = []) {
  const { table, column } = TABLES[owner.type];
  const { data, info } = await sharp(input, { limitInputPixels: 100_000_000 })
    .rotate() // applique l’orientation EXIF
    .resize({ width: MAX_WIDTH[kind], withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });

  const file = await storeFile(data);

  // Une seule couverture, un seul arrière-plan, un seul logo : la nouvelle image remplace l’ancienne.
  const single = SINGLE_KINDS.includes(kind);
  const old = single
    ? await db.prepare(`SELECT file FROM ${table} WHERE ${column} = ? AND kind = ?`).all<{ file: string }>(owner.id, kind)
    : [];
  const { next } = (await db
    .prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM ${table} WHERE ${column} = ? AND kind = ?`)
    .get<{ next: number }>(owner.id, kind))!;
  const results = await db.batch([
    ...(single ? [{ sql: `DELETE FROM ${table} WHERE ${column} = ? AND kind = ?`, args: [owner.id, kind] }] : []),
    {
      sql: `INSERT INTO ${table} (${column}, kind, file, alt, width, height, position) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [owner.id, kind, file, alt, info.width, info.height, single ? 0 : next],
    },
    ...extra,
  ]);
  await Promise.all(old.map((image) => removeFile(image.file)));
  const inserted = results[single ? 1 : 0];
  return { id: inserted.lastInsertRowid, file, width: info.width, height: info.height, replaced: old.length > 0 };
}

// Avatar d’un membre de l’équipe : recadré en carré 256 px, en WebP. Renvoie la valeur à garder en base.
export async function saveAvatar(input: Buffer) {
  const data = await sharp(input, { limitInputPixels: 100_000_000 })
    .rotate()
    .resize(256, 256, { fit: "cover" })
    .webp({ quality: 85 })
    .toBuffer();
  return storeFile(data);
}

// Miniature d’une actualité : 1200 px de large au plus, en WebP. Renvoie la valeur à garder en base.
export async function saveThumbnail(input: Buffer) {
  const data = await sharp(input, { limitInputPixels: 100_000_000 })
    .rotate()
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
  return storeFile(data);
}

export async function removeFile(file: string) {
  if (!file) return;
  if (/^https?:\/\//.test(file)) {
    if (!blobEnabled()) return;
    try {
      await del(file);
    } catch (error) {
      console.error("Suppression impossible sur Vercel Blob :", error);
    }
    return;
  }
  if (!FILE_PATTERN.test(file)) return;
  await fs.rm(path.join(UPLOAD_DIR, file), { force: true });
}

// Dimensions d’une image déjà envoyée (nom de fichier ou adresse Blob) ou d’une adresse externe.
// Connues de la galerie si possible, sinon lues sur l’image ; 0 × 0 si elle est illisible.
export async function measureImage(file: string): Promise<{ width: number; height: number }> {
  if (!file) return { width: 0, height: 0 };
  const known = await db.prepare("SELECT width, height FROM novel_image WHERE file = ?").get<{ width: number; height: number }>(file);
  if (known) return { width: Number(known.width), height: Number(known.height) };
  try {
    const data = /^https?:\/\//.test(file)
      ? Buffer.from(await (await fetch(file, { signal: AbortSignal.timeout(10_000) })).arrayBuffer())
      : FILE_PATTERN.test(file)
        ? await fs.readFile(path.join(UPLOAD_DIR, file))
        : null;
    if (!data) return { width: 0, height: 0 };
    const { width = 0, height = 0 } = await sharp(data, { limitInputPixels: 100_000_000 }).metadata();
    return { width, height };
  } catch {
    return { width: 0, height: 0 };
  }
}
