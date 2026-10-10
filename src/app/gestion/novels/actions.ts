"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { guard, isHttpUrl, type ActionResult } from "@/lib/action-guard";
import { db } from "@/lib/db";
import { NOVEL_STATUSES, uniqueChapterSlug, type Chapter, type Volume } from "@/lib/novels";
import { slugify } from "@/lib/patches";
import { removeFile } from "@/lib/uploads";

export type { ActionResult };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

// Date la modification du novel et rafraîchit la page affichée.
function changed(novelId: number): ActionResult {
  db.prepare("UPDATE novel SET updatedAt = datetime('now') WHERE id = ?").run(novelId);
  refresh();
  return { savedAt: Date.now() };
}

function uniqueNovelSlug(title: string) {
  const base = slugify(title) || "novel";
  const taken = db.prepare("SELECT 1 FROM novel WHERE slug = ?");
  let slug = base;
  for (let n = 2; taken.get(slug); n++) slug = `${base}-${n}`;
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
  };
  if (!title || title.length > 180) return { error: "Le titre est requis (180 caractères maximum)." };
  if (!(NOVEL_STATUSES as readonly string[]).includes(fields.status)) return { error: "Statut invalide." };
  if (fields.synopsis.length > 20_000) return { error: "La présentation est trop longue (20 000 caractères maximum)." };

  const id = Number(formData.get("id")) || null;
  if (id === null) {
    const { lastInsertRowid } = db
      .prepare("INSERT INTO novel (slug, title, originalTitle, author, artist, status, synopsis) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(uniqueNovelSlug(title), title, fields.originalTitle, fields.author, fields.artist, fields.status, fields.synopsis);
    redirect(`/gestion/novels/${lastInsertRowid}?cree=1`);
  }
  const { changes } = db
    .prepare("UPDATE novel SET title = ?, originalTitle = ?, author = ?, artist = ?, status = ?, synopsis = ? WHERE id = ?")
    .run(title, fields.originalTitle, fields.author, fields.artist, fields.status, fields.synopsis, id);
  if (!changes) return { error: "Novel introuvable." };
  return changed(id);
}

export async function deleteNovel(novelId: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const images = db.prepare("SELECT file FROM novel_image WHERE novelId = ?").all(novelId) as { file: string }[];
  db.prepare("DELETE FROM novel WHERE id = ?").run(novelId); // tomes, chapitres et images suivent
  await Promise.all(images.map((image) => removeFile(image.file)));
  redirect("/gestion");
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
  if (db.prepare("SELECT 1 FROM volume WHERE novelId = ? AND number = ?").get(novelId, number)) {
    return { error: `Le tome ${number} existe déjà.` };
  }
  db.prepare("INSERT INTO volume (novelId, number, title) VALUES (?, ?, ?)").run(novelId, number, parsed.title);
  return changed(novelId);
}

export async function updateVolume(volumeId: number, number: number, title: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const parsed = readVolume(number, title);
  if (parsed.error) return parsed;
  const volume = db.prepare("SELECT * FROM volume WHERE id = ?").get(volumeId) as Volume | undefined;
  if (!volume) return { error: "Tome introuvable." };
  if (db.prepare("SELECT 1 FROM volume WHERE novelId = ? AND number = ? AND id != ?").get(volume.novelId, number, volumeId)) {
    return { error: `Le tome ${number} existe déjà.` };
  }
  db.prepare("UPDATE volume SET number = ?, title = ? WHERE id = ?").run(number, parsed.title, volumeId);
  return changed(volume.novelId);
}

export async function deleteVolume(volumeId: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const volume = db.prepare("SELECT * FROM volume WHERE id = ?").get(volumeId) as Volume | undefined;
  if (!volume) return { error: "Tome introuvable." };
  db.prepare("DELETE FROM volume WHERE id = ?").run(volumeId); // ses chapitres suivent
  return changed(volume.novelId);
}

// ——— Chapitres ———

export async function saveChapter(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const volumeId = Number(formData.get("volumeId"));
  const volume = db.prepare("SELECT * FROM volume WHERE id = ?").get(volumeId) as Volume | undefined;
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
    const slug = uniqueChapterSlug(volume.novelId, volume.number, label);
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO chapter (novelId, volumeId, slug, position, label, title, content, published, translators, downloadUrl)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(volume.novelId, volume.id, slug, position, label, title, content, published, translators, downloadUrl);
    db.prepare("UPDATE novel SET updatedAt = datetime('now') WHERE id = ?").run(volume.novelId);
    redirect(`/gestion/chapitres/${lastInsertRowid}?cree=1`);
  }

  const chapter = db.prepare("SELECT novelId FROM chapter WHERE id = ?").get(id) as Pick<Chapter, "novelId"> | undefined;
  if (!chapter) return { error: "Chapitre introuvable." };
  if (chapter.novelId !== volume.novelId) return { error: "Ce tome appartient à un autre novel." };
  // L’adresse publique (slug) ne change pas après la création : les liens existants restent valides.
  db.prepare(
    `UPDATE chapter SET volumeId = ?, position = ?, label = ?, title = ?, content = ?, published = ?, translators = ?,
       downloadUrl = ?, updatedAt = datetime('now') WHERE id = ?`,
  ).run(volume.id, position, label, title, content, published, translators, downloadUrl, id);
  return changed(chapter.novelId);
}

export async function deleteChapter(chapterId: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const chapter = db.prepare("SELECT novelId FROM chapter WHERE id = ?").get(chapterId) as Pick<Chapter, "novelId"> | undefined;
  if (!chapter) return { error: "Chapitre introuvable." };
  db.prepare("DELETE FROM chapter WHERE id = ?").run(chapterId);
  db.prepare("UPDATE novel SET updatedAt = datetime('now') WHERE id = ?").run(chapter.novelId);
  redirect(`/gestion/novels/${chapter.novelId}`);
}
