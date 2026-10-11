"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { guard, isHttpUrl, type ActionResult } from "@/lib/action-guard";
import { db } from "@/lib/db";
import { NOVEL_STATUSES, uniqueChapterSlug, type Chapter, type Volume } from "@/lib/novels";
import { slugify } from "@/lib/patches";
import { setNovelMembers } from "@/lib/team";
import { removeFile } from "@/lib/uploads";

export type { ActionResult };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

// Date la modification du novel et rafraîchit la page affichée.
async function changed(novelId: number): Promise<ActionResult> {
  await db.prepare("UPDATE novel SET updatedAt = datetime('now') WHERE id = ?").run(novelId);
  refresh();
  return { savedAt: Date.now() };
}

async function uniqueNovelSlug(title: string) {
  const base = slugify(title) || "novel";
  const taken = db.prepare("SELECT 1 FROM novel WHERE slug = ?");
  let slug = base;
  for (let n = 2; await taken.get(slug); n++) slug = `${base}-${n}`;
  return slug;
}

// ——— Novels ———

export async function saveNovel(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const title = text(formData, "title");
  const fields = {
    originalTitle: text(formData, "originalTitle").slice(0, 180),
    author: text(formData, "author").slice(0, 120),
    artist: text(formData, "artist").slice(0, 120),
    status: text(formData, "status"),
    synopsis: text(formData, "synopsis"),
    quote: text(formData, "quote"),
    featured: formData.get("featured") === "1" ? 1 : 0,
  };
  if (!title || title.length > 180) return { error: "Le titre est requis (180 caractères maximum)." };
  if (!(NOVEL_STATUSES as readonly string[]).includes(fields.status)) return { error: "Statut invalide." };
  if (fields.synopsis.length > 20_000) return { error: "La présentation est trop longue (20 000 caractères maximum)." };
  if (fields.quote.length > 120) return { error: "La citation est trop longue (120 caractères maximum)." };

  const id = Number(formData.get("id")) || null;
  if (id === null) {
    const { lastInsertRowid } = await db
      .prepare(
        "INSERT INTO novel (slug, title, originalTitle, author, artist, status, synopsis, quote, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        await uniqueNovelSlug(title),
        title,
        fields.originalTitle,
        fields.author,
        fields.artist,
        fields.status,
        fields.synopsis,
        fields.quote,
        fields.featured,
      );
    redirect(`/gestion/novels/${lastInsertRowid}?cree=1`);
  }
  const { changes } = await db
    .prepare(
      "UPDATE novel SET title = ?, originalTitle = ?, author = ?, artist = ?, status = ?, synopsis = ?, quote = ?, featured = ? WHERE id = ?",
    )
    .run(title, fields.originalTitle, fields.author, fields.artist, fields.status, fields.synopsis, fields.quote, fields.featured, id);
  if (!changes) return { error: "Novel introuvable." };
  return await changed(id);
}

export async function deleteNovel(novelId: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const images = await db.prepare("SELECT file FROM novel_image WHERE novelId = ?").all<{ file: string }>(novelId);
  await db.prepare("DELETE FROM novel_member WHERE novelId = ?").run(novelId);
  await db.prepare("DELETE FROM novel WHERE id = ?").run(novelId); // tomes, chapitres et images suivent
  await Promise.all(images.map((image) => removeFile(image.file)));
  redirect("/gestion");
}

// Membres de l’équipe affichés sur la fiche du novel.
export async function saveNovelMembers(novelId: number, memberIds: number[]): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!(await db.prepare("SELECT 1 FROM novel WHERE id = ?").get(novelId))) return { error: "Novel introuvable." };
  await setNovelMembers(novelId, memberIds);
  return await changed(novelId);
}

// Retire l’arrière-plan (la fiche revient à la couverture floutée) ou le logo du carrousel.
// Seuls ces deux types sont acceptés : les illustrations des chapitres ne sont jamais touchées.
export async function deleteNovelImage(novelId: number, kind: "background" | "logo"): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (kind !== "background" && kind !== "logo") return { error: "Type d’image invalide." };

  const images = await db
    .prepare("SELECT file FROM novel_image WHERE novelId = ? AND kind = ?")
    .all<{ file: string }>(novelId, kind);
  if (images.length === 0) return { error: "Aucune image à supprimer." };
  await db.prepare("DELETE FROM novel_image WHERE novelId = ? AND kind = ?").run(novelId, kind);
  await Promise.all(images.map((image) => removeFile(image.file)));
  return await changed(novelId);
}

// ——— Tomes ———

function readVolume(number: number, title: string) {
  if (!Number.isInteger(number) || number < 0 || number > 999) return { error: "Le numéro de tome doit être un entier positif." };
  return { title: title.trim().slice(0, 180) };
}

export async function addVolume(novelId: number, number: number, title: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = readVolume(number, title);
  if (parsed.error) return parsed;
  if (await db.prepare("SELECT 1 FROM volume WHERE novelId = ? AND number = ?").get(novelId, number)) {
    return { error: `Le tome ${number} existe déjà.` };
  }
  await db.prepare("INSERT INTO volume (novelId, number, title) VALUES (?, ?, ?)").run(novelId, number, parsed.title ?? "");
  return await changed(novelId);
}

export async function updateVolume(volumeId: number, number: number, title: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = readVolume(number, title);
  if (parsed.error) return parsed;
  const volume = await db.prepare("SELECT * FROM volume WHERE id = ?").get(volumeId) as Volume | undefined;
  if (!volume) return { error: "Tome introuvable." };
  if (await db.prepare("SELECT 1 FROM volume WHERE novelId = ? AND number = ? AND id != ?").get(volume.novelId, number, volumeId)) {
    return { error: `Le tome ${number} existe déjà.` };
  }
  await db.prepare("UPDATE volume SET number = ?, title = ? WHERE id = ?").run(number, parsed.title ?? "", volumeId);
  return await changed(volume.novelId);
}

export async function deleteVolume(volumeId: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const volume = await db.prepare("SELECT * FROM volume WHERE id = ?").get(volumeId) as Volume | undefined;
  if (!volume) return { error: "Tome introuvable." };
  await db.prepare("DELETE FROM volume WHERE id = ?").run(volumeId); // ses chapitres suivent
  return await changed(volume.novelId);
}

// ——— Chapitres ———

export async function saveChapter(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const volumeId = Number(formData.get("volumeId"));
  const volume = await db.prepare("SELECT * FROM volume WHERE id = ?").get(volumeId) as Volume | undefined;
  if (!volume) return { error: "Choisissez un tome." };

  const label = text(formData, "label");
  const title = text(formData, "title");
  const position = Number(formData.get("position"));
  const published = formData.get("published") === "1" ? 1 : 0;
  const translators = text(formData, "translators");
  const downloadUrl = text(formData, "downloadUrl");
  const content = String(formData.get("content") ?? "").trim();

  if (!label || label.length > 80) return { error: "Le libellé est requis (ex. « Chapitre 3 », 80 caractères maximum)." };
  if (title.length > 180) return { error: "Le titre est trop long (180 caractères maximum)." };
  if (!Number.isInteger(position) || position < 0) return { error: "L’ordre doit être un entier positif." };
  if (translators.length > 200) return { error: "Le champ traduction est trop long." };
  if (downloadUrl && !isHttpUrl(downloadUrl)) return { error: "Le lien de téléchargement doit commencer par http:// ou https://." };
  if (content.length > 2_000_000) return { error: "Le texte est trop long." };
  if (published && !content) return { error: "Un chapitre publié ne peut pas être vide." };

  const id = Number(formData.get("id")) || null;
  if (id === null) {
    const slug = await uniqueChapterSlug(volume.novelId, volume.number, label);
    const { lastInsertRowid } = await db
      .prepare(
        `INSERT INTO chapter (novelId, volumeId, slug, position, label, title, content, published, translators, downloadUrl)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(volume.novelId, volume.id, slug, position, label, title, content, published, translators, downloadUrl);
    await db.prepare("UPDATE novel SET updatedAt = datetime('now') WHERE id = ?").run(volume.novelId);
    redirect(`/gestion/chapitres/${lastInsertRowid}?cree=1`);
  }

  const chapter = await db.prepare("SELECT novelId FROM chapter WHERE id = ?").get(id) as Pick<Chapter, "novelId"> | undefined;
  if (!chapter) return { error: "Chapitre introuvable." };
  if (chapter.novelId !== volume.novelId) return { error: "Ce tome appartient à un autre novel." };
  // L’adresse publique (slug) ne change pas après la création : les liens existants restent valides.
  await db.prepare(
    `UPDATE chapter SET volumeId = ?, position = ?, label = ?, title = ?, content = ?, published = ?, translators = ?,
       downloadUrl = ?, updatedAt = datetime('now') WHERE id = ?`,
  ).run(volume.id, position, label, title, content, published, translators, downloadUrl, id);
  return await changed(chapter.novelId);
}

export async function deleteChapter(chapterId: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const chapter = await db.prepare("SELECT novelId FROM chapter WHERE id = ?").get(chapterId) as Pick<Chapter, "novelId"> | undefined;
  if (!chapter) return { error: "Chapitre introuvable." };
  await db.prepare("DELETE FROM chapter WHERE id = ?").run(chapterId);
  await db.prepare("UPDATE novel SET updatedAt = datetime('now') WHERE id = ?").run(chapter.novelId);
  redirect(`/gestion/novels/${chapter.novelId}`);
}
