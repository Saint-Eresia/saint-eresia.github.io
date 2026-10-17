"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { teamActor, type ActionResult } from "@/lib/action-guard";
import { diff, logEntry } from "@/lib/activity";
import { db } from "@/lib/db";
import { announce } from "@/lib/discord";
import { uniqueNewsSlug, type News } from "@/lib/news";

export type { ActionResult };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function saveNews(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;

  const title = text(formData, "title");
  const content = text(formData, "content");
  const published = formData.get("published") === "1" ? 1 : 0;
  if (!title || title.length > 180) return { error: "Le titre est requis (180 caractères maximum)." };
  if (content.length > 50_000) return { error: "Le texte est trop long (50 000 caractères maximum)." };
  if (published && !content) return { error: "Une actualité publiée ne peut pas être vide." };

  const id = Number(formData.get("id")) || null;
  if (id === null) {
    const slug = await uniqueNewsSlug(title);
    const [created] = await db.batch([
      {
        sql: `INSERT INTO news (slug, title, content, author, published, publishedAt)
              VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN datetime('now') END)`,
        args: [slug, title, content, actor.name, published, published],
      },
      logEntry(actor, { type: "news", id: "last", label: title, action: "create" }),
    ]);
    if (published) announceNews({ slug, title, content });
    redirect(`/gestion/actualites/${created.lastInsertRowid}?cree=1`);
  }

  const before = await db.prepare("SELECT * FROM news WHERE id = ?").get<News>(id);
  if (!before) return { error: "Actualité introuvable." };
  // La date de publication est fixée la première fois que l’actualité passe en « Publiée ».
  await db.batch([
    {
      sql: `UPDATE news SET title = ?, content = ?, published = ?,
              publishedAt = CASE WHEN ? = 1 THEN COALESCE(publishedAt, datetime('now')) ELSE publishedAt END,
              updatedAt = datetime('now')
            WHERE id = ?`,
      args: [title, content, published, published, id],
    },
    logEntry(actor, {
      type: "news",
      id,
      label: title,
      action: "update",
      changes: diff([
        { label: "Titre", before: before.title, after: title },
        { label: "Statut", before: before.published ? "Publiée" : "Brouillon", after: published ? "Publiée" : "Brouillon" },
        { label: "Texte", before: before.content, after: content, long: true },
      ]),
    }),
  ]);
  refresh();
  // Annonce à la première publication seulement.
  if (published && !before.publishedAt) announceNews({ slug: before.slug, title, content });
  return { savedAt: Date.now() };
}

// Annonce Discord d’une actualité, après la réponse : titre, lien et début du texte.
function announceNews(news: Pick<News, "slug" | "title" | "content">) {
  const excerpt = news.content
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_#>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  after(() => announce({ title: news.title, path: `/actualites/${news.slug}`, description: excerpt.length > 300 ? `${excerpt.slice(0, 300)}…` : excerpt }));
}

export async function deleteNews(id: number): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;
  const news = await db.prepare("SELECT title FROM news WHERE id = ?").get<{ title: string }>(id);
  if (!news) return { error: "Actualité introuvable." };
  await db.batch([
    { sql: "DELETE FROM news WHERE id = ?", args: [id] },
    logEntry(actor, { type: "news", id, label: news.title, action: "delete" }),
  ]);
  redirect("/gestion?onglet=actualites");
}
