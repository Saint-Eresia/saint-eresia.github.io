import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import sharp from "sharp";
import { db, UPLOAD_DIR } from "@/lib/db";

export { fileUrl } from "@/lib/file-url";

export const FILE_PATTERN = /^[0-9a-f-]{36}\.webp$/;
const MAX_WIDTH = { cover: 1600, screenshot: 2560, illustration: 2000, background: 2560 } as const;
export type ImageKind = keyof typeof MAX_WIDTH;
// Types d’image uniques par propriétaire : la nouvelle remplace l’ancienne.
export const SINGLE_KINDS: readonly ImageKind[] = ["cover", "background"];

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

// Convertit l’image en WebP, l’enregistre et l’ajoute à son propriétaire.
export async function saveImage(owner: ImageOwner, kind: ImageKind, input: Buffer, alt: string) {
  const { table, column } = TABLES[owner.type];
  const { data, info } = await sharp(input, { limitInputPixels: 100_000_000 })
    .rotate() // applique l’orientation EXIF
    .resize({ width: MAX_WIDTH[kind], withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });

  const file = await storeFile(data);

  // Une seule couverture et un seul arrière-plan : la nouvelle image remplace l’ancienne.
  if (SINGLE_KINDS.includes(kind)) {
    const old = await db.prepare(`SELECT file FROM ${table} WHERE ${column} = ? AND kind = ?`).all<{ file: string }>(owner.id, kind);
    await db.prepare(`DELETE FROM ${table} WHERE ${column} = ? AND kind = ?`).run(owner.id, kind);
    await Promise.all(old.map((image) => removeFile(image.file)));
  }
  const { next } = (await db
    .prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM ${table} WHERE ${column} = ? AND kind = ?`)
    .get<{ next: number }>(owner.id, kind))!;
  const { lastInsertRowid } = await db
    .prepare(`INSERT INTO ${table} (${column}, kind, file, alt, width, height, position) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(owner.id, kind, file, alt, info.width, info.height, next);
  return { id: lastInsertRowid, file, width: info.width, height: info.height };
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
