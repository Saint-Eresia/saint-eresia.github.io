"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { guard, type ActionResult } from "@/lib/action-guard";
import { db } from "@/lib/db";
import { uniqueNewsSlug } from "@/lib/news";
import { getViewer } from "@/lib/viewer";

export type { ActionResult };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function saveNews(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const title = text(formData, "title");
  const content = text(formData, "content");
  const published = formData.get("published") === "1" ? 1 : 0;
  if (!title || title.length > 180) return { error: "Le titre est requis (180 caractères maximum)." };
  if (content.length > 50_000) return { error: "Le texte est trop long (50 000 caractères maximum)." };
  if (published && !content) return { error: "Une actualité publiée ne peut pas être vide." };

  const id = Number(formData.get("id")) || null;
  if (id === null) {
    const author = (await getViewer())?.name ?? "";
    const { lastInsertRowid } = await db
      .prepare(
        `INSERT INTO news (slug, title, content, author, published, publishedAt)
         VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN datetime('now') END)`,
      )
      .run(await uniqueNewsSlug(title), title, content, author, published, published);
    redirect(`/gestion/actualites/${lastInsertRowid}?cree=1`);
  }

  // La date de publication est fixée la première fois que l’actualité passe en « Publiée ».
  const { changes } = await db
    .prepare(
      `UPDATE news SET title = ?, content = ?, published = ?,
         publishedAt = CASE WHEN ? = 1 THEN COALESCE(publishedAt, datetime('now')) ELSE publishedAt END,
         updatedAt = datetime('now')
       WHERE id = ?`,
    )
    .run(title, content, published, published, id);
  if (!changes) return { error: "Actualité introuvable." };
  refresh();
  return { savedAt: Date.now() };
}

export async function deleteNews(id: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const { changes } = await db.prepare("DELETE FROM news WHERE id = ?").run(id);
  if (!changes) return { error: "Actualité introuvable." };
  redirect("/gestion");
}
