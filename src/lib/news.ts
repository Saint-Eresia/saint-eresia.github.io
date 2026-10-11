import "server-only";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { slugify } from "@/lib/patches";

export type News = {
  id: number;
  slug: string;
  title: string;
  content: string;
  author: string;
  published: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// Date affichée : celle de la publication, sinon celle de la création (brouillon).
export const newsDate = (news: Pick<News, "publishedAt" | "createdAt">) => news.publishedAt ?? news.createdAt;

// Texte brut pour l’aperçu : sans images, liens réduits à leur texte, sans marques de mise en forme.
export function excerpt(markdown: string, length = 180) {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > length ? `${text.slice(0, length).replace(/\s+\S*$/, "")}…` : text;
}

// connection() empêche que ces lectures soient figées au build : la base change après le déploiement.
export async function listNews({ publishedOnly, limit }: { publishedOnly: boolean; limit?: number }) {
  await connection();
  const where = publishedOnly ? "WHERE published = 1" : "";
  const rows = await db
    .prepare(`SELECT * FROM news ${where} ORDER BY COALESCE(publishedAt, createdAt) DESC, id DESC ${limit ? "LIMIT ?" : ""}`)
    .all<News>(...(limit ? [limit] : []));
  return rows;
}

export async function getPublishedNews(slug: string) {
  await connection();
  return (await db.prepare("SELECT * FROM news WHERE slug = ? AND published = 1").get<News>(slug)) ?? null;
}

export async function getNewsById(id: number) {
  await connection();
  return (await db.prepare("SELECT * FROM news WHERE id = ?").get<News>(id)) ?? null;
}

// L’adresse publique est fixée à la création : les liens partagés restent valides.
export async function uniqueNewsSlug(title: string) {
  const base = slugify(title) || "actualite";
  const taken = db.prepare("SELECT 1 FROM news WHERE slug = ?");
  let slug = base;
  for (let n = 2; await taken.get(slug); n++) slug = `${base}-${n}`;
  return slug;
}
