import { connection } from "next/server";
import { db } from "@/lib/db";
import { chapterItems, rssResponse } from "@/lib/feed";

// Flux RSS d’un novel : ses derniers chapitres publiés. Annoncé dans l’en-tête de sa fiche et lié depuis celle-ci.
export async function GET(request: Request, ctx: RouteContext<"/novels/[slug]/feed.xml">) {
  await connection();
  const origin = new URL(request.url).origin;
  const novel = await db
    .prepare("SELECT id, slug, title FROM novel WHERE slug = ? AND draft = 0")
    .get<{ id: number; slug: string; title: string }>((await ctx.params).slug);
  if (!novel) return new Response("Light novel introuvable.", { status: 404 });
  return rssResponse({
    title: `${novel.title} · Saint Eresia`,
    link: `${origin}/novels/${novel.slug}`,
    self: `${origin}/novels/${novel.slug}/feed.xml`,
    description: `Nouveaux chapitres de ${novel.title}, traduits en français par Saint Eresia.`,
    items: await chapterItems(origin, Number(novel.id)),
  });
}
