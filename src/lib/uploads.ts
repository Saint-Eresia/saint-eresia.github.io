import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { db, UPLOAD_DIR } from "@/lib/db";

export const FILE_PATTERN = /^[0-9a-f-]{36}\.webp$/;
const MAX_WIDTH = { cover: 1600, screenshot: 2560, illustration: 2000 } as const;
export type ImageKind = keyof typeof MAX_WIDTH;

// Une image appartient à un patch (patch_image) ou à un roman (novel_image).
export type ImageOwner = { type: "patch" | "novel"; id: number };
const TABLES = {
  patch: { table: "patch_image", column: "patchId" },
  novel: { table: "novel_image", column: "novelId" },
} as const;

// Convertit l’image en WebP, l’enregistre dans data/uploads/ et l’ajoute à son propriétaire.
export async function saveImage(owner: ImageOwner, kind: ImageKind, input: Buffer, alt: string) {
  const { table, column } = TABLES[owner.type];
  const { data, info } = await sharp(input, { limitInputPixels: 100_000_000 })
    .rotate() // applique l’orientation EXIF
    .resize({ width: MAX_WIDTH[kind], withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer({ resolveWithObject: true });

  const file = `${randomUUID()}.webp`;
  await fs.writeFile(path.join(UPLOAD_DIR, file), data);

  // Une seule couverture : la nouvelle remplace l’ancienne.
  if (kind === "cover") {
    const old = db.prepare(`SELECT file FROM ${table} WHERE ${column} = ? AND kind = 'cover'`).all(owner.id) as { file: string }[];
    db.prepare(`DELETE FROM ${table} WHERE ${column} = ? AND kind = 'cover'`).run(owner.id);
    await Promise.all(old.map((image) => removeFile(image.file)));
  }
  const { next } = db
    .prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM ${table} WHERE ${column} = ? AND kind = ?`)
    .get(owner.id, kind) as { next: number };
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO ${table} (${column}, kind, file, alt, width, height, position) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(owner.id, kind, file, alt, info.width, info.height, next);
  return { id: Number(lastInsertRowid), file, width: info.width, height: info.height };
}

// Avatar d’un membre de l’équipe : recadré en carré 256 px, en WebP. Renvoie le nom du fichier.
export async function saveAvatar(input: Buffer) {
  const data = await sharp(input, { limitInputPixels: 100_000_000 })
    .rotate()
    .resize(256, 256, { fit: "cover" })
    .webp({ quality: 85 })
    .toBuffer();
  const file = `${randomUUID()}.webp`;
  await fs.writeFile(path.join(UPLOAD_DIR, file), data);
  return file;
}

export async function removeFile(file: string) {
  if (!FILE_PATTERN.test(file)) return;
  await fs.rm(path.join(UPLOAD_DIR, file), { force: true });
}
