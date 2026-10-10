import "server-only";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { slugify } from "@/lib/patches";

export const NOVEL_STATUSES = ["En cours", "Terminé", "En pause", "Abandonné", "Licencié"] as const;

export type NovelImage = { id: number; novelId: number; kind: "cover" | "illustration"; file: string; alt: string; width: number; height: number };
export type Novel = {
  id: number;
  slug: string;
  title: string;
  originalTitle: string;
  author: string;
  artist: string;
  status: string;
  synopsis: string;
  createdAt: string;
  updatedAt: string;
};
export type Volume = { id: number; novelId: number; number: number; title: string };
export type Chapter = {
  id: number;
  novelId: number;
  volumeId: number;
  slug: string;
  position: number;
  label: string;
  title: string;
  content: string;
  published: number;
  translators: string;
  downloadUrl: string;
  createdAt: string;
  updatedAt: string;
};
export type ChapterSummary = Omit<Chapter, "content">;
export type VolumeWithChapters = Volume & { chapters: ChapterSummary[] };

const SUMMARY_COLUMNS =
  "c.id, c.novelId, c.volumeId, c.slug, c.position, c.label, c.title, c.published, c.translators, c.downloadUrl, c.createdAt, c.updatedAt";

export const chapterHeading = (chapter: Pick<Chapter, "label" | "title">) =>
  chapter.title && chapter.title !== chapter.label ? `${chapter.label} — ${chapter.title}` : chapter.label;
export const volumeHeading = (volume: Pick<Volume, "number" | "title">) =>
  volume.title ? `Tome ${volume.number} — ${volume.title}` : `Tome ${volume.number}`;

const coverOf = (novelId: number) =>
  (db.prepare("SELECT * FROM novel_image WHERE novelId = ? AND kind = 'cover'").get(novelId) as NovelImage | undefined) ?? null;

function volumesOf(novelId: number, publishedOnly: boolean): VolumeWithChapters[] {
  const volumes = db.prepare("SELECT * FROM volume WHERE novelId = ? ORDER BY number").all(novelId) as Volume[];
  const chapters = db
    .prepare(
      `SELECT ${SUMMARY_COLUMNS} FROM chapter c JOIN volume v ON v.id = c.volumeId
       WHERE c.novelId = ? ${publishedOnly ? "AND c.published = 1" : ""} ORDER BY v.number, c.position, c.id`,
    )
    .all(novelId) as ChapterSummary[];
  const withChapters = volumes.map((volume) => ({ ...volume, chapters: chapters.filter((c) => c.volumeId === volume.id) }));
  // Côté public, un tome sans chapitre publié n’apparaît pas.
  return publishedOnly ? withChapters.filter((volume) => volume.chapters.length > 0) : withChapters;
}

// better-sqlite3 est synchrone : connection() empêche que ces lectures soient figées au build.
export async function listNovels() {
  await connection();
  const novels = db.prepare("SELECT * FROM novel ORDER BY updatedAt DESC, id DESC").all() as Novel[];
  const count = db.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(published), 0) AS published FROM chapter WHERE novelId = ?");
  return novels.map((novel) => {
    const { total, published } = count.get(novel.id) as { total: number; published: number };
    return { ...novel, cover: coverOf(novel.id), chapterCount: total, publishedCount: published };
  });
}

export async function getNovelBySlug(slug: string) {
  await connection();
  const novel = db.prepare("SELECT * FROM novel WHERE slug = ?").get(slug) as Novel | undefined;
  if (!novel) return null;
  return { ...novel, cover: coverOf(novel.id), volumes: volumesOf(novel.id, true) };
}

// Gestion : tous les chapitres, brouillons compris.
export async function getNovelById(id: number) {
  await connection();
  const novel = db.prepare("SELECT * FROM novel WHERE id = ?").get(id) as Novel | undefined;
  if (!novel) return null;
  return { ...novel, cover: coverOf(novel.id), volumes: volumesOf(novel.id, false) };
}

// Lecture publique d’un chapitre, avec les chapitres publiés voisins.
export async function getPublishedChapter(novelSlug: string, chapterSlug: string) {
  await connection();
  const novel = db.prepare("SELECT * FROM novel WHERE slug = ?").get(novelSlug) as Novel | undefined;
  if (!novel) return null;
  const chapter = db
    .prepare("SELECT * FROM chapter WHERE novelId = ? AND slug = ? AND published = 1")
    .get(novel.id, chapterSlug) as Chapter | undefined;
  if (!chapter) return null;
  const volume = db.prepare("SELECT * FROM volume WHERE id = ?").get(chapter.volumeId) as Volume;
  const order = volumesOf(novel.id, true).flatMap((v) => v.chapters);
  const index = order.findIndex((c) => c.id === chapter.id);
  return { novel, volume, chapter, previous: order[index - 1] ?? null, next: order[index + 1] ?? null };
}

export async function getChapterById(id: number) {
  await connection();
  const chapter = db.prepare("SELECT * FROM chapter WHERE id = ?").get(id) as Chapter | undefined;
  if (!chapter) return null;
  const novel = db.prepare("SELECT * FROM novel WHERE id = ?").get(chapter.novelId) as Novel;
  const volumes = db.prepare("SELECT * FROM volume WHERE novelId = ? ORDER BY number").all(novel.id) as Volume[];
  return { chapter, novel, volumes };
}

export async function getVolumeWithNovel(volumeId: number) {
  await connection();
  const volume = db.prepare("SELECT * FROM volume WHERE id = ?").get(volumeId) as Volume | undefined;
  if (!volume) return null;
  const novel = db.prepare("SELECT * FROM novel WHERE id = ?").get(volume.novelId) as Novel;
  const volumes = db.prepare("SELECT * FROM volume WHERE novelId = ? ORDER BY number").all(novel.id) as Volume[];
  const { next } = db
    .prepare("SELECT COALESCE(MAX(position), 0) + 1 AS next FROM chapter WHERE volumeId = ?")
    .get(volume.id) as { next: number };
  return { volume, novel, volumes, nextPosition: next };
}

// « Tome 1 » dans le tome 1 → tome-1 ; « Chapitre 3 » dans le tome 2 → tome-2-chapitre-3.
export function uniqueChapterSlug(novelId: number, volumeNumber: number, label: string, excludeId = 0) {
  const prefix = `tome-${volumeNumber}`;
  const part = slugify(label) || "chapitre";
  const base = part === prefix || part.startsWith(`${prefix}-`) ? part : `${prefix}-${part}`;
  const taken = db.prepare("SELECT 1 FROM chapter WHERE novelId = ? AND slug = ? AND id != ?");
  let slug = base;
  for (let n = 2; taken.get(novelId, slug, excludeId); n++) slug = `${base}-${n}`;
  return slug;
}
