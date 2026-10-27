import "server-only";
import { db } from "@/lib/db";
import { chapterHeading } from "@/lib/novels";

// Flux RSS : celui du site (src/app/feed.xml) et celui de chaque novel (src/app/novels/[slug]/feed.xml).
export const FEED_LIMIT = 50;
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Dates SQLite (UTC, « AAAA-MM-JJ HH:MM:SS ») au format RSS.
const rssDate = (date: string) => new Date(`${date.replace(" ", "T")}Z`).toUTCString();

export type FeedItem = { title: string; link: string; date: string; description: string; category: string };

// Derniers chapitres publiés des novels publics ; `novelId` : ceux d’un seul novel.
export async function chapterItems(origin: string, novelId?: number): Promise<FeedItem[]> {
  const chapters = await db
    .prepare(
      `SELECT c.slug, c.label, c.title, COALESCE(c.publishedAt, c.createdAt) AS date, n.slug AS novelSlug, n.title AS novelTitle
       FROM chapter c JOIN novel n ON n.id = c.novelId
       WHERE c.published = 1 AND n.draft = 0 ${novelId === undefined ? "" : "AND n.id = ?"} ORDER BY date DESC, c.id DESC LIMIT ?`,
    )
    .all<{ slug: string; label: string; title: string; date: string; novelSlug: string; novelTitle: string }>(
      ...(novelId === undefined ? [] : [novelId]),
      FEED_LIMIT,
    );
  return chapters.map((c) => ({
    title: `${c.novelTitle} — ${chapterHeading(c)}`,
    link: `${origin}/novels/${c.novelSlug}/${c.slug}`,
    date: c.date,
    description: `Nouveau chapitre de ${c.novelTitle} : ${chapterHeading(c)}.`,
    category: "Light novels",
  }));
}

export function rssResponse({ title, link, self, description, items }: { title: string; link: string; self: string; description: string; items: FeedItem[] }) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${escape(title)}</title>
<link>${escape(link)}</link>
<atom:link href="${escape(self)}" rel="self" type="application/rss+xml"/>
<description>${escape(description)}</description>
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
