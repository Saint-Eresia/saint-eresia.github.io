import { connection } from "next/server";
import { db } from "@/lib/db";
import { chapterHeading } from "@/lib/novels";

// Flux RSS du site : derniers chapitres publiés (novels publics) et dernières actualités.
// Annoncé dans l’en-tête des pages (layout) pour que les lecteurs de flux le trouvent tout seuls.
const LIMIT = 50;
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Dates SQLite (UTC, « AAAA-MM-JJ HH:MM:SS ») au format RSS.
const rssDate = (date: string) => new Date(`${date.replace(" ", "T")}Z`).toUTCString();

type Item = { title: string; link: string; date: string; description: string; category: string };

export async function GET(request: Request) {
  await connection();
  const origin = new URL(request.url).origin;
  const chapters = await db
    .prepare(
      `SELECT c.slug, c.label, c.title, COALESCE(c.publishedAt, c.createdAt) AS date, n.slug AS novelSlug, n.title AS novelTitle
       FROM chapter c JOIN novel n ON n.id = c.novelId
       WHERE c.published = 1 AND n.draft = 0 ORDER BY date DESC, c.id DESC LIMIT ?`,
    )
    .all<{ slug: string; label: string; title: string; date: string; novelSlug: string; novelTitle: string }>(LIMIT);
  const news = await db
    .prepare("SELECT slug, title, content, COALESCE(publishedAt, createdAt) AS date FROM news WHERE published = 1 ORDER BY date DESC LIMIT ?")
    .all<{ slug: string; title: string; content: string; date: string }>(LIMIT);

  const items: Item[] = [
    ...chapters.map((c) => ({
      title: `${c.novelTitle} — ${chapterHeading(c)}`,
      link: `${origin}/novels/${c.novelSlug}/${c.slug}`,
      date: c.date,
      description: `Nouveau chapitre de ${c.novelTitle} : ${chapterHeading(c)}.`,
      category: "Light novels",
    })),
    ...news.map((n) => ({
      title: n.title,
      link: `${origin}/actualites/${n.slug}`,
      date: n.date,
      // Début du texte, débarrassé de la syntaxe Markdown la plus courante.
      description: n.content.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_#>`]/g, "").replace(/\s+/g, " ").trim().slice(0, 300),
      category: "Actualités",
    })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, LIMIT);

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>Saint Eresia</title>
<link>${origin}</link>
<atom:link href="${origin}/feed.xml" rel="self" type="application/rss+xml"/>
<description>Nouveaux chapitres de light novels et actualités de Saint Eresia.</description>
<language>fr</language>
${items
  .map(
    (item) => `<item>
<title>${escape(item.title)}</title>
<link>${escape(item.link)}</link>
<guid isPermaLink="true">${escape(item.link)}</guid>
<pubDate>${rssDate(item.date)}</pubDate>
<category>${item.category}</category>
<description>${escape(item.description)}</description>
</item>`,
  )
  .join("\n")}
</channel>
</rss>
`;
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600" },
  });
}
