import { connection } from "next/server";
import { db } from "@/lib/db";
import { chapterItems, FEED_LIMIT, rssResponse, type FeedItem } from "@/lib/feed";

// Flux RSS du site : derniers chapitres publiés (novels publics) et dernières actualités.
// Annoncé dans l’en-tête des pages (layout) pour que les lecteurs de flux le trouvent tout seuls.
// Chaque novel a aussi le sien, avec ses seuls chapitres : src/app/novels/[slug]/feed.xml.
export async function GET(request: Request) {
  await connection();
  const origin = new URL(request.url).origin;
  const news = await db
    .prepare("SELECT slug, title, content, COALESCE(publishedAt, createdAt) AS date FROM news WHERE published = 1 ORDER BY date DESC LIMIT ?")
    .all<{ slug: string; title: string; content: string; date: string }>(FEED_LIMIT);

  const items: FeedItem[] = [
    ...(await chapterItems(origin)),
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
    .slice(0, FEED_LIMIT);

  return rssResponse({
    title: "Saint Eresia",
    link: origin,
    self: `${origin}/feed.xml`,
    description: "Nouveaux chapitres de light novels et actualités de Saint Eresia.",
    items,
  });
}
