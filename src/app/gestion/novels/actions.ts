"use server";

import type { InStatement } from "@libsql/client";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { isHttpUrl, teamActor, type ActionResult } from "@/lib/action-guard";
import { diff, logEntry, type Actor, type Change, type EntityType } from "@/lib/activity";
import { db } from "@/lib/db";
import { announce } from "@/lib/discord";
import { chapterHeading, NOVEL_STATUSES, uniqueChapterSlug, volumeHeading, type Chapter, type Novel, type Volume } from "@/lib/novels";
import { slugify } from "@/lib/patches";
import { isRoleKey, NOVEL_ROLE_KEYS, type RoleKey } from "@/lib/roles";
import { setProjectTeam, type TeamEntry } from "@/lib/team";
import { fileUrl, IMAGE_KIND_LABELS, removeFile } from "@/lib/uploads";

export type { ActionResult };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const touch = (novelId: number): InStatement => ({ sql: "UPDATE novel SET updatedAt = datetime('now') WHERE id = ?", args: [novelId] });
const findNovel = (id: number) => db.prepare("SELECT * FROM novel WHERE id = ?").get<Novel>(id);
const findVolume = (id: number) => db.prepare("SELECT * FROM volume WHERE id = ?").get<Volume>(id);

// Modification : la modification, la date de mise à jour du novel et le journal, en une seule transaction.
async function commit(
  actor: Actor,
  novelId: number,
  statements: InStatement[],
  entry: { type: EntityType; id: number | "last" | null; label: string; action: "create" | "update" | "delete"; changes?: Change[] },
) {
  const results = await db.batch([...statements, touch(novelId), logEntry(actor, entry)]);
  refresh();
  return results;
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
  const actor = await teamActor();
  if ("error" in actor) return actor;

  const title = text(formData, "title");
  const fields = {
    originalTitle: text(formData, "originalTitle").slice(0, 180),
    author: text(formData, "author").slice(0, 120),
    artist: text(formData, "artist").slice(0, 120),
    status: text(formData, "status"),
    synopsis: text(formData, "synopsis"),
    quote: text(formData, "quote"),
    quoteNote: text(formData, "quoteNote"),
    format: text(formData, "format").slice(0, 20),
    released: text(formData, "released").slice(0, 40),
    featured: formData.get("featured") === "1" ? 1 : 0,
    draft: formData.get("draft") === "1" ? 1 : 0,
  };
  if (!title || title.length > 180) return { error: "Le titre est requis (180 caractères maximum)." };
  if (!(NOVEL_STATUSES as readonly string[]).includes(fields.status)) return { error: "Statut invalide." };
  if (fields.synopsis.length > 20_000) return { error: "La présentation est trop longue (20 000 caractères maximum)." };
  if (fields.quote.length > 120) return { error: "La citation est trop longue (120 caractères maximum)." };
  if (fields.quoteNote.length > 200) return { error: "Le commentaire de la citation est trop long (200 caractères maximum)." };

  const id = Number(formData.get("id")) || null;
  if (id === null) {
    const [created] = await db.batch([
      {
        sql: `INSERT INTO novel (slug, title, originalTitle, author, artist, status, synopsis, quote, quoteNote, format, released, featured, draft)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          await uniqueNovelSlug(title),
          title,
          fields.originalTitle,
          fields.author,
          fields.artist,
          fields.status,
          fields.synopsis,
          fields.quote,
          fields.quoteNote,
          fields.format,
          fields.released,
          fields.featured,
          fields.draft,
        ],
      },
      logEntry(actor, { type: "novel", id: "last", label: title, action: "create" }),
    ]);
    redirect(`/gestion/novels/${created.lastInsertRowid}?cree=1`);
  }

  const before = await findNovel(id);
  if (!before) return { error: "Novel introuvable." };
  await commit(
    actor,
    id,
    [
      {
        sql: `UPDATE novel SET title = ?, originalTitle = ?, author = ?, artist = ?, status = ?, synopsis = ?, quote = ?, quoteNote = ?,
                format = ?, released = ?, featured = ?, draft = ? WHERE id = ?`,
        args: [
          title,
          fields.originalTitle,
          fields.author,
          fields.artist,
          fields.status,
          fields.synopsis,
          fields.quote,
          fields.quoteNote,
          fields.format,
          fields.released,
          fields.featured,
          fields.draft,
          id,
        ],
      },
    ],
    {
      type: "novel",
      id,
      label: title,
      action: "update",
      changes: diff([
        { label: "Titre", before: before.title, after: title },
        { label: "Visibilité", before: before.draft ? "Brouillon" : "Publié", after: fields.draft ? "Brouillon" : "Publié" },
        { label: "Titre original", before: before.originalTitle, after: fields.originalTitle },
        { label: "Auteur", before: before.author, after: fields.author },
        { label: "Illustrateur", before: before.artist, after: fields.artist },
        { label: "Statut", before: before.status, after: fields.status },
        { label: "Format", before: before.format, after: fields.format },
        { label: "Sortie", before: before.released, after: fields.released },
        { label: "Citation", before: before.quote, after: fields.quote },
        { label: "Commentaire de la citation", before: before.quoteNote, after: fields.quoteNote },
        { label: "Recommandé sur l’accueil", before: before.featured ? "Oui" : "Non", after: fields.featured ? "Oui" : "Non" },
        { label: "Présentation", before: before.synopsis, after: fields.synopsis, long: true },
      ]),
    },
  );
  return { savedAt: Date.now() };
}

export async function deleteNovel(novelId: number): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;
  const novel = await findNovel(novelId);
  if (!novel) return { error: "Novel introuvable." };

  const images = await db.prepare("SELECT file FROM novel_image WHERE novelId = ?").all<{ file: string }>(novelId);
  await db.batch([
    { sql: "DELETE FROM novel_member_role WHERE novelId = ?", args: [novelId] },
    { sql: "DELETE FROM novel_member WHERE novelId = ?", args: [novelId] },
    { sql: "DELETE FROM chapter WHERE novelId = ?", args: [novelId] },
    { sql: "DELETE FROM volume WHERE novelId = ?", args: [novelId] },
    { sql: "DELETE FROM novel_image WHERE novelId = ?", args: [novelId] },
    { sql: "DELETE FROM novel WHERE id = ?", args: [novelId] },
    logEntry(actor, { type: "novel", id: novelId, label: novel.title, action: "delete" }),
  ]);
  await Promise.all(images.map((image) => removeFile(image.file)));
  redirect("/gestion?onglet=novels");
}

// Équipe du novel : ses membres et leurs rôles (rôles NOVEL_ROLE_KEYS), affichés sur la fiche et la page Équipe.
export async function saveNovelTeam(novelId: number, entries: TeamEntry[]): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;
  const novel = await findNovel(novelId);
  if (!novel) return { error: "Novel introuvable." };
  if (!Array.isArray(entries) || entries.length > 100) return { error: "Équipe invalide." };
  const clean = entries.map((entry) => ({
    memberId: Number(entry?.memberId),
    roles: (Array.isArray(entry?.roles) ? entry.roles : []).filter((role): role is RoleKey => typeof role === "string" && isRoleKey(role)),
  }));
  if (clean.some((entry) => !Number.isInteger(entry.memberId))) return { error: "Membre invalide." };

  await setProjectTeam("novel", novelId, clean, NOVEL_ROLE_KEYS, (changes) => [
    touch(novelId),
    logEntry(actor, { type: "novel", id: novelId, label: novel.title, action: "update", changes }),
  ]);
  refresh();
  return { savedAt: Date.now() };
}

// Retire l’arrière-plan (la fiche revient à la couverture floutée) ou le logo du carrousel.
// Seuls ces deux types sont acceptés : les illustrations des chapitres ne sont jamais touchées.
export async function deleteNovelImage(novelId: number, kind: "background" | "logo"): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;
  if (kind !== "background" && kind !== "logo") return { error: "Type d’image invalide." };
  const novel = await findNovel(novelId);
  if (!novel) return { error: "Novel introuvable." };

  const images = await db.prepare("SELECT file FROM novel_image WHERE novelId = ? AND kind = ?").all<{ file: string }>(novelId, kind);
  if (images.length === 0) return { error: "Aucune image à supprimer." };
  await commit(actor, novelId, [{ sql: "DELETE FROM novel_image WHERE novelId = ? AND kind = ?", args: [novelId, kind] }], {
    type: "novel",
    id: novelId,
    label: novel.title,
    action: "update",
    changes: [{ field: IMAGE_KIND_LABELS[kind], before: "image", after: "(supprimée)" }],
  });
  await Promise.all(images.map((image) => removeFile(image.file)));
  return { savedAt: Date.now() };
}

// Retire une illustration du texte d’un chapitre (avec sa ligne de crédit « *Rôle : Nom* » éventuelle),
// depuis la page des illustrations d’un tome. Le fichier est supprimé s’il ne sert plus dans aucun chapitre.
export async function deleteIllustration(novelId: number, chapterSlug: string, src: string): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;
  const novel = await findNovel(novelId);
  if (!novel) return { error: "Novel introuvable." };
  const chapter = await db.prepare("SELECT * FROM chapter WHERE novelId = ? AND slug = ?").get<Chapter>(novelId, chapterSlug);
  if (!chapter) return { error: "Chapitre introuvable." };

  const escaped = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const image = new RegExp(`\\s*!\\[[^\\]]*\\]\\(${escaped}\\)(?:[ \\t]*\\r?\\n[ \\t]*(?:\\r?\\n[ \\t]*)?\\*[^*\\n]+ : [^*\\n]+\\*)?\\s*`);
  if (!image.test(chapter.content)) return { error: "Cette illustration n’est plus dans le chapitre. Rechargez la page." };
  const content = chapter.content.replace(image, "\n\n").trim();

  await commit(
    actor,
    novelId,
    [{ sql: "UPDATE chapter SET content = ?, updatedAt = datetime('now') WHERE id = ?", args: [content, chapter.id] }],
    {
      type: "chapter",
      id: chapter.id,
      label: chapterLabel(novel, chapter),
      action: "update",
      changes: diff([{ label: "Texte", before: chapter.content, after: content, long: true }]),
    },
  );

  // Fichier (et entrée de la galerie du novel) supprimés seulement s’il n’apparaît plus dans aucun chapitre.
  const stillUsed = await db.prepare("SELECT 1 FROM chapter WHERE novelId = ? AND instr(content, ?) > 0").get(novelId, `(${src})`);
  if (!stillUsed) {
    const file = src.replace(/^\/uploads\//, "");
    const found = await db.prepare("SELECT 1 FROM novel_image WHERE novelId = ? AND kind = 'illustration' AND file = ?").get(novelId, file);
    if (found) {
      await db.prepare("DELETE FROM novel_image WHERE novelId = ? AND kind = 'illustration' AND file = ?").run(novelId, file);
      await removeFile(file);
    }
  }
  return { savedAt: Date.now() };
}

// ——— Tomes ———

export type VolumeInput = { number: number; label: string; title: string; note: string; image: string; imageCredit: string };

function readVolume(input: VolumeInput) {
  const { number } = input;
  if (!Number.isInteger(number) || number < 0 || number > 999) return { error: "Le numéro de tome doit être un entier positif." };
  if (input.note.trim().length > 2000) return { error: "La précision du tome est trop longue (2000 caractères au plus)." };
  const image = input.image.trim();
  // URL complète, ou chemin d’un fichier envoyé (/uploads/…) ramené à son nom comme les autres images.
  const file = image.replace(/^\/uploads\//, "");
  if (image && !isHttpUrl(image) && (file === image || file.includes("/"))) return { error: "L’image du tome doit être une adresse http(s) ou une image envoyée." };
  if (input.imageCredit.trim().length > 300) return { error: "Le crédit de l’image est trop long (300 caractères au plus)." };
  return {
    volume: {
      number,
      label: input.label.trim().slice(0, 60),
      title: input.title.trim().slice(0, 180),
      note: input.note.trim(),
      image: file,
      imageCredit: input.imageCredit.trim(),
    },
  };
}

const volumeLabel = (novel: Pick<Novel, "title">, volume: Pick<Volume, "number" | "title" | "label">) => `${novel.title} — ${volumeHeading(volume)}`;

export async function addVolume(novelId: number, input: VolumeInput): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;
  const parsed = readVolume(input);
  if (!parsed.volume) return { error: parsed.error };
  const { number, label, title, note, image, imageCredit } = parsed.volume;
  const novel = await findNovel(novelId);
  if (!novel) return { error: "Novel introuvable." };
  if (await db.prepare("SELECT 1 FROM volume WHERE novelId = ? AND number = ?").get(novelId, number)) {
    return { error: `Le tome ${number} existe déjà.` };
  }
  await db.batch([
    {
      sql: "INSERT INTO volume (novelId, number, label, title, note, image, imageCredit) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [novelId, number, label, title, note, image, imageCredit],
    },
    logEntry(actor, { type: "volume", id: "last", label: volumeLabel(novel, parsed.volume), action: "create" }),
    touch(novelId),
  ]);
  refresh();
  return { savedAt: Date.now() };
}

export async function updateVolume(volumeId: number, input: VolumeInput): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;
  const parsed = readVolume(input);
  if (!parsed.volume) return { error: parsed.error };
  const { number, label, title, note, image, imageCredit } = parsed.volume;
  const volume = await findVolume(volumeId);
  if (!volume) return { error: "Tome introuvable." };
  if (await db.prepare("SELECT 1 FROM volume WHERE novelId = ? AND number = ? AND id != ?").get(volume.novelId, number, volumeId)) {
    return { error: `Le tome ${number} existe déjà.` };
  }
  const novel = (await findNovel(volume.novelId))!;
  await commit(
    actor,
    volume.novelId,
    [
      {
        sql: "UPDATE volume SET number = ?, label = ?, title = ?, note = ?, image = ?, imageCredit = ? WHERE id = ?",
        args: [number, label, title, note, image, imageCredit, volumeId],
      },
    ],
    {
      type: "volume",
      id: volumeId,
      label: volumeLabel(novel, parsed.volume),
      action: "update",
      changes: diff([
        { label: "Numéro", before: volume.number, after: number },
        { label: "Intitulé", before: volume.label, after: label },
        { label: "Titre", before: volume.title, after: title },
        { label: "Précision", before: volume.note, after: note, long: true },
        { label: "Image", before: volume.image, after: image },
        { label: "Crédit de l’image", before: volume.imageCredit, after: imageCredit },
      ]),
    },
  );
  return { savedAt: Date.now() };
}

export async function deleteVolume(volumeId: number): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;
  const volume = await findVolume(volumeId);
  if (!volume) return { error: "Tome introuvable." };
  const novel = (await findNovel(volume.novelId))!;
  await commit(
    actor,
    volume.novelId,
    [
      { sql: "DELETE FROM chapter WHERE volumeId = ?", args: [volumeId] },
      { sql: "DELETE FROM volume WHERE id = ?", args: [volumeId] },
    ],
    { type: "volume", id: volumeId, label: volumeLabel(novel, volume), action: "delete" },
  );
  return { savedAt: Date.now() };
}

// Déplace des chapitres vers un autre tome du même novel, à la suite de ses chapitres (ordre de sélection conservé).
// L’adresse publique des chapitres (slug) ne change pas : les liens déjà partagés restent valides.
export async function moveChapters(novelId: number, chapterIds: number[], volumeId: number): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;
  const novel = await findNovel(novelId);
  if (!novel) return { error: "Novel introuvable." };
  const target = await findVolume(volumeId);
  if (!target || Number(target.novelId) !== novelId) return { error: "Choisissez un tome de ce novel." };
  const ids = [...new Set((Array.isArray(chapterIds) ? chapterIds : []).map(Number))];
  if (ids.length === 0 || ids.length > 500) return { error: "Sélectionnez au moins un chapitre." };

  const chapters = await db
    .prepare(
      `SELECT c.id, c.label, c.title, c.volumeId, c.position FROM chapter c JOIN volume v ON v.id = c.volumeId
       WHERE c.novelId = ? AND c.id IN (${ids.map(() => "?").join(", ")}) ORDER BY v.number, c.position, c.id`,
    )
    .all<Pick<Chapter, "id" | "label" | "title" | "volumeId" | "position">>(novelId, ...ids);
  if (chapters.length !== ids.length) return { error: "Certains chapitres n’appartiennent pas à ce novel. Rechargez la page." };
  const moving = chapters.filter((chapter) => Number(chapter.volumeId) !== volumeId);
  if (moving.length === 0) return { error: `Ces chapitres sont déjà dans le tome ${target.number}.` };

  const volumes = new Map(
    (await db.prepare("SELECT * FROM volume WHERE novelId = ?").all<Volume>(novelId)).map((volume) => [Number(volume.id), volume]),
  );
  const { last } = (await db
    .prepare("SELECT COALESCE(MAX(position), 0) AS last FROM chapter WHERE volumeId = ?")
    .get<{ last: number }>(volumeId))!;
  await db.batch([
    ...moving.flatMap((chapter, index) => [
      {
        sql: "UPDATE chapter SET volumeId = ?, position = ?, updatedAt = datetime('now') WHERE id = ?",
        args: [volumeId, Number(last) + index + 1, chapter.id],
      },
      logEntry(actor, {
        type: "chapter",
        id: Number(chapter.id),
        label: chapterLabel(novel, chapter),
        action: "update",
        changes: [
          {
            field: "Tome",
            before: volumeHeading(volumes.get(Number(chapter.volumeId)) ?? { number: 0, title: "", label: "" }),
            after: volumeHeading(target),
          },
        ],
      }),
    ]),
    touch(novelId),
  ]);
  refresh();
  return { savedAt: Date.now() };
}

// ——— Chapitres ———

const chapterLabel = (novel: Pick<Novel, "title">, chapter: Pick<Chapter, "label" | "title">) => `${novel.title} — ${chapterHeading(chapter)}`;

export async function saveChapter(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;

  const volumeId = Number(formData.get("volumeId"));
  const volume = await findVolume(volumeId);
  if (!volume) return { error: "Choisissez un tome." };

  const label = text(formData, "label");
  const title = text(formData, "title");
  const position = Number(formData.get("position"));
  const published = formData.get("published") === "1" ? 1 : 0;
  const translators = text(formData, "translators");
  const credits = String(formData.get("credits") ?? "").trim();
  const downloadUrl = text(formData, "downloadUrl");
  const phase = text(formData, "phase");
  const releaseDate = text(formData, "releaseDate");
  const content = String(formData.get("content") ?? "").trim();

  if (releaseDate && (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate) || Number.isNaN(Date.parse(releaseDate)))) return { error: "La date de sortie n’est pas valide." };
  if (!label || label.length > 80) return { error: "Le libellé est requis (ex. « Chapitre 3 », 80 caractères maximum)." };
  if (title.length > 180) return { error: "Le titre est trop long (180 caractères maximum)." };
  if (!Number.isInteger(position) || position < 0) return { error: "L’ordre doit être un entier positif." };
  if (translators.length > 200) return { error: "Le champ traduction est trop long." };
  if (phase.length > 80) return { error: "Le nom de la phase est trop long (80 caractères maximum)." };
  if (credits.length > 1000) return { error: "Les crédits détaillés sont trop longs (1000 caractères maximum)." };
  if (downloadUrl && !isHttpUrl(downloadUrl)) return { error: "Le lien de téléchargement doit commencer par http:// ou https://." };
  if (content.length > 2_000_000) return { error: "Le texte est trop long." };
  if (published && !content) return { error: "Un chapitre publié ne peut pas être vide." };

  const novel = (await findNovel(volume.novelId))!;
  const id = Number(formData.get("id")) || null;
  if (id === null) {
    const slug = await uniqueChapterSlug(volume.novelId, volume.number, label);
    const [created] = await commit(
      actor,
      volume.novelId,
      [
        {
          sql: `INSERT INTO chapter (novelId, volumeId, slug, position, label, title, content, published, translators, credits, downloadUrl, phase, publishedAt)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CASE WHEN ? <> '' THEN ? || ' 12:00:00' WHEN ? = 1 THEN datetime('now') END)`,
          args: [volume.novelId, volume.id, slug, position, label, title, content, published, translators, credits, downloadUrl, phase, releaseDate, releaseDate, published],
        },
      ],
      // last_insert_rowid() reste celui du chapitre : la mise à jour de date intercalée n’est pas une insertion.
      { type: "chapter", id: "last", label: chapterLabel(novel, { label, title }), action: "create" },
    );
    if (published) announceChapter(novel, { slug, label, title });
    redirect(`/gestion/chapitres/${created.lastInsertRowid}?cree=1`);
  }

  const before = await db.prepare("SELECT * FROM chapter WHERE id = ?").get<Chapter>(id);
  if (!before) return { error: "Chapitre introuvable." };
  if (before.novelId !== volume.novelId) return { error: "Ce tome appartient à un autre novel." };
  const beforeVolume = before.volumeId === volume.id ? volume : await findVolume(before.volumeId);
  // L’adresse publique (slug) ne change pas après la création : les liens existants restent valides.
  await commit(
    actor,
    before.novelId,
    [
      {
        sql: `UPDATE chapter SET volumeId = ?, position = ?, label = ?, title = ?, content = ?, published = ?, translators = ?,
                credits = ?, downloadUrl = ?, phase = ?,
                -- Date de sortie choisie (l'heure d'origine est gardée si le jour ne change pas), sinon automatique.
                publishedAt = CASE WHEN ? <> '' THEN (CASE WHEN substr(publishedAt, 1, 10) = ? THEN publishedAt ELSE ? || ' 12:00:00' END)
                                   WHEN ? = 1 THEN COALESCE(publishedAt, datetime('now')) ELSE publishedAt END,
                updatedAt = datetime('now') WHERE id = ?`,
        args: [volume.id, position, label, title, content, published, translators, credits, downloadUrl, phase, releaseDate, releaseDate, releaseDate, published, id],
      },
    ],
    {
      type: "chapter",
      id,
      label: chapterLabel(novel, { label, title }),
      action: "update",
      changes: diff([
        { label: "Libellé", before: before.label, after: label },
        { label: "Titre", before: before.title, after: title },
        { label: "Tome", before: beforeVolume ? volumeHeading(beforeVolume) : "", after: volumeHeading(volume) },
        { label: "Ordre", before: before.position, after: position },
        { label: "Phase", before: before.phase, after: phase },
        { label: "Statut", before: before.published ? "Publié" : "Brouillon", after: published ? "Publié" : "Brouillon" },
        { label: "Traduction", before: before.translators, after: translators },
        { label: "Crédits détaillés", before: before.credits, after: credits },
        { label: "Lien de téléchargement", before: before.downloadUrl, after: downloadUrl },
        { label: "Date de sortie", before: before.publishedAt?.slice(0, 10) ?? "", after: releaseDate || (before.publishedAt?.slice(0, 10) ?? "") },
        { label: "Texte", before: before.content, after: content, long: true },
      ]),
    },
  );
  // Annonce à la première publication seulement (pas à chaque correction d’un chapitre déjà publié).
  if (published && !before.published && !before.publishedAt) announceChapter(novel, { slug: before.slug, label, title });
  return { savedAt: Date.now() };
}

// Annonce Discord d’un nouveau chapitre, après la réponse (sans la retarder). Pas d’annonce pour un brouillon de novel.
function announceChapter(novel: Novel, chapter: Pick<Chapter, "slug" | "label" | "title">) {
  if (novel.draft) return;
  after(async () => {
    const cover = await db.prepare("SELECT file FROM novel_image WHERE novelId = ? AND kind = 'cover'").get<{ file: string }>(novel.id);
    await announce({
      title: `${novel.title} — ${chapterHeading(chapter)}`,
      path: `/novels/${novel.slug}/${chapter.slug}`,
      description: "Nouveau chapitre disponible à la lecture.",
      image: cover ? fileUrl(cover.file) : null,
    });
  });
}

export async function deleteChapter(chapterId: number): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;
  const chapter = await db.prepare("SELECT * FROM chapter WHERE id = ?").get<Chapter>(chapterId);
  if (!chapter) return { error: "Chapitre introuvable." };
  const novel = (await findNovel(chapter.novelId))!;
  await commit(actor, chapter.novelId, [{ sql: "DELETE FROM chapter WHERE id = ?", args: [chapterId] }], {
    type: "chapter",
    id: chapterId,
    label: chapterLabel(novel, chapter),
    action: "delete",
  });
  redirect(`/gestion/novels/${chapter.novelId}`);
}
