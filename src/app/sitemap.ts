import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { patchHref } from "@/lib/patch-kinds";
import { siteUrl } from "@/lib/site-url";

// Plan du site pour les moteurs de recherche : pages publiques, novels publiés et leurs chapitres, patchs, actualités.
// Dates SQLite (UTC) converties en dates ISO.
const iso = (date: string) => new Date(`${date.replace(" ", "T")}Z`);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = siteUrl();
  const [novels, chapters, patches, news] = await Promise.all([
    db.prepare("SELECT slug, updatedAt FROM novel WHERE draft = 0").all<{ slug: string; updatedAt: string }>(),
    db
      .prepare(
        `SELECT n.slug AS novelSlug, c.slug, c.updatedAt FROM chapter c JOIN novel n ON n.id = c.novelId
         WHERE c.published = 1 AND n.draft = 0`,
      )
      .all<{ novelSlug: string; slug: string; updatedAt: string }>(),
    db.prepare("SELECT slug, kind, updatedAt FROM patch WHERE draft = 0").all<{ slug: string; kind: string; updatedAt: string }>(),
    db.prepare("SELECT slug, updatedAt FROM news WHERE published = 1").all<{ slug: string; updatedAt: string }>(),
  ]);
  return [
    ...["", "/novels", "/patchs", "/jeux", "/actualites", "/equipe", "/a-propos", "/plus"].map((path) => ({ url: `${base}${path}` })),
    ...novels.map((n) => ({ url: `${base}/novels/${n.slug}`, lastModified: iso(n.updatedAt) })),
    ...chapters.map((c) => ({ url: `${base}/novels/${c.novelSlug}/${c.slug}`, lastModified: iso(c.updatedAt) })),
    ...patches.map((p) => ({ url: `${base}${patchHref(p)}`, lastModified: iso(p.updatedAt) })),
    ...news.map((n) => ({ url: `${base}/actualites/${n.slug}`, lastModified: iso(n.updatedAt) })),
  ];
}
