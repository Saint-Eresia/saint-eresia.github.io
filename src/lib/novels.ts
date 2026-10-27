import "server-only";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { slugify } from "@/lib/patches";
import { getViewer } from "@/lib/viewer";

export const NOVEL_STATUSES = ["En cours", "Terminé", "En pause", "Abandonné", "Licencié"] as const;

export type NovelImage = {
  id: number;
  novelId: number;
  kind: "cover" | "illustration" | "background" | "logo";
  file: string;
  alt: string;
  width: number;
  height: number;
};
export type Novel = {
  id: number;
  slug: string;
  title: string;
  originalTitle: string;
  author: string;
  artist: string;
  status: string;
  synopsis: string;
  quote: string; // citation du carrousel « Recommandé » et de l’en-tête de la fiche
  quoteNote: string; // commentaire de la citation, affiché au survol sur la fiche
  format: string; // badge à côté de la couverture (ex. « WN », « LN »)
  released: string; // période de sortie (ex. « Depuis 2012 »)
  featured: number; // 1 : affiché dans le carrousel de l’accueil
  draft: number; // 1 : brouillon, invisible du public (voir isPublicNovel)
  createdAt: string;
  updatedAt: string;
};
// label : intitulé remplaçant « Tome N » (ex. « Arc VI ») ; note : précision en Markdown affichée sous l’en-tête ;
// image : image en tête du tome dans le sommaire (URL ou fichier envoyé), imageCredit : son crédit (Markdown).
export type Volume = {
  id: number;
  novelId: number;
  number: number;
  title: string;
  label: string;
  note: string;
  image: string;
  imageCredit: string;
  imageWidth: number; // dimensions de l’image (0 : inconnues) ; en portrait, elle est affichée en couverture
  imageHeight: number;
  reedit: number; // 1 : traduit par une autre équipe, ré-édité par Saint Eresia (mention « Re:edit »)
};
export type Chapter = {
  id: number;
  novelId: number;
  volumeId: number;
  slug: string;
  position: number;
  label: string;
  title: string;
  content: string;
  published: number;
  translators: string;
  credits: string; // crédits détaillés, sous le titre du chapitre seulement
  downloadUrl: string;
  phase: string; // partie du tome (ex. « Phase 3 »), sous-titre du sommaire
  publishedAt: string | null; // première publication
  createdAt: string;
  updatedAt: string;
};
export type ChapterSummary = Omit<Chapter, "content">;
export type VolumeWithChapters = Volume & { chapters: ChapterSummary[]; illustrationCount: number };

const SUMMARY_COLUMNS =
  "c.id, c.novelId, c.volumeId, c.slug, c.position, c.label, c.title, c.published, c.translators, c.credits, c.downloadUrl, c.phase, c.publishedAt, c.createdAt, c.updatedAt";

// « Chapitre 12 : Titre » (espace insécable avant les deux-points).
export const chapterHeading = (chapter: Pick<Chapter, "label" | "title">) =>
  chapter.title && chapter.title !== chapter.label ? `${chapter.label} : ${chapter.title}` : chapter.label;
export const volumeName = (volume: Pick<Volume, "number"> & { label?: string }) => volume.label || `Tome ${volume.number}`;
export const volumeHeading = (volume: Pick<Volume, "number" | "title"> & { label?: string }) =>
  volume.title ? `${volumeName(volume)} — ${volume.title}` : volumeName(volume);

const imageOf = async (novelId: number, kind: "cover" | "background" | "logo") =>
  (await db.prepare("SELECT * FROM novel_image WHERE novelId = ? AND kind = ?").get<NovelImage>(novelId, kind)) ?? null;
export const coverOf = (novelId: number) => imageOf(novelId, "cover");
// Image large affichée derrière l’en-tête de la fiche ; à défaut, la couverture floutée.
const backgroundOf = (novelId: number) => imageOf(novelId, "background");
// Logo (PNG détouré) affiché à droite dans le carrousel « Recommandé » de l’accueil.
const logoOf = (novelId: number) => imageOf(novelId, "logo");

// Dernier chapitre publié, dans l’ordre de lecture (tome puis position).
async function latestChapterOf(novelId: number) {
  return (
    (await db
      .prepare(
        `SELECT c.slug, c.label, c.title FROM chapter c JOIN volume v ON v.id = c.volumeId
         WHERE c.novelId = ? AND c.published = 1 ORDER BY v.number DESC, c.position DESC, c.id DESC LIMIT 1`,
      )
      .get<Pick<Chapter, "slug" | "label" | "title">>(novelId)) ?? null
  );
}

// Novels du carrousel « Recommandé » de l’accueil, du plus récemment mis à jour au plus ancien.
export async function listFeaturedNovels() {
  await connection();
  const novels = await db.prepare("SELECT * FROM novel WHERE featured = 1 AND draft = 0 ORDER BY updatedAt DESC, id DESC").all<Novel>();
  return Promise.all(
    novels.map(async (novel) => ({
      ...novel,
      cover: await coverOf(novel.id),
      background: await backgroundOf(novel.id),
      logo: await logoOf(novel.id),
      latestChapter: await latestChapterOf(novel.id),
    })),
  );
}

async function volumesOf(novelId: number, publishedOnly: boolean): Promise<VolumeWithChapters[]> {
  const volumes = await db.prepare("SELECT * FROM volume WHERE novelId = ? ORDER BY number").all<Volume>(novelId);
  const chapters = await db
    .prepare(
      `SELECT ${SUMMARY_COLUMNS} FROM chapter c JOIN volume v ON v.id = c.volumeId
       WHERE c.novelId = ? ${publishedOnly ? "AND c.published = 1" : ""} ORDER BY v.number, c.position, c.id`,
    )
    .all<ChapterSummary>(novelId);
  // Nombre d’images Markdown (« ![ ») dans les chapitres publiés de chaque tome, pour le lien vers ses illustrations.
  const counts = await db
    .prepare(
      `SELECT volumeId, SUM((length(content) - length(replace(content, '![', ''))) / 2) AS n
       FROM chapter WHERE novelId = ? AND published = 1 GROUP BY volumeId`,
    )
    .all<{ volumeId: number; n: number }>(novelId);
  const withChapters = volumes.map((volume) => ({
    ...volume,
    chapters: chapters.filter((c) => c.volumeId === volume.id),
    illustrationCount: Number(counts.find((row) => row.volumeId === volume.id)?.n ?? 0),
  }));
  // Côté public, un tome sans chapitre publié n’apparaît pas.
  return publishedOnly ? withChapters.filter((volume) => volume.chapters.length > 0) : withChapters;
}

// connection() empêche que ces lectures soient figées au build : la base change après le déploiement.
// Par défaut, les novels publics seulement ; `drafts: true` ajoute les brouillons (gestion).
export async function listNovels({ drafts = false }: { drafts?: boolean } = {}) {
  await connection();
  const novels = await db
    .prepare(`SELECT * FROM novel ${drafts ? "" : "WHERE draft = 0"} ORDER BY updatedAt DESC, id DESC`)
    .all<Novel>();
  const count = db.prepare("SELECT COUNT(*) AS total, COALESCE(SUM(published), 0) AS published FROM chapter WHERE novelId = ?");
  return Promise.all(
    novels.map(async (novel) => {
      const { total, published } = (await count.get<{ total: number; published: number }>(novel.id))!;
      return { ...novel, cover: await coverOf(novel.id), chapterCount: total, publishedCount: published };
    }),
  );
}

// Un brouillon n’est visible que par l’équipe : les pages publiques vérifient `canSeeNovel` avant d’afficher.
export const isPublicNovel = (novel: Pick<Novel, "draft">) => Number(novel.draft) === 0;
export async function canSeeNovel(novel: Pick<Novel, "draft">) {
  return isPublicNovel(novel) || Boolean((await getViewer())?.isTeam);
}

export async function getNovelBySlug(slug: string) {
  await connection();
  const novel = await db.prepare("SELECT * FROM novel WHERE slug = ?").get<Novel>(slug);
  if (!novel) return null;
  return {
    ...novel,
    cover: await coverOf(novel.id),
    background: await backgroundOf(novel.id),
    volumes: await volumesOf(novel.id, true),
  };
}

// Gestion : tous les chapitres, brouillons compris.
export async function getNovelById(id: number) {
  await connection();
  const novel = await db.prepare("SELECT * FROM novel WHERE id = ?").get<Novel>(id);
  if (!novel) return null;
  return {
    ...novel,
    cover: await coverOf(novel.id),
    background: await backgroundOf(novel.id),
    logo: await logoOf(novel.id),
    volumes: await volumesOf(novel.id, false),
  };
}

// Lecture publique d’un chapitre, avec les chapitres publiés voisins.
export async function getPublishedChapter(novelSlug: string, chapterSlug: string) {
  await connection();
  const novel = await db.prepare("SELECT * FROM novel WHERE slug = ?").get(novelSlug) as Novel | undefined;
  if (!novel) return null;
  const chapter = await db
    .prepare("SELECT * FROM chapter WHERE novelId = ? AND slug = ? AND published = 1")
    .get(novel.id, chapterSlug) as Chapter | undefined;
  if (!chapter) return null;
  const volume = (await db.prepare("SELECT * FROM volume WHERE id = ?").get<Volume>(chapter.volumeId))!;
  const order = (await volumesOf(novel.id, true)).flatMap((v) => v.chapters);
  const index = order.findIndex((c) => c.id === chapter.id);
  return { novel, volume, chapter, previous: order[index - 1] ?? null, next: order[index + 1] ?? null };
}

export async function getChapterById(id: number) {
  await connection();
  const chapter = await db.prepare("SELECT * FROM chapter WHERE id = ?").get(id) as Chapter | undefined;
  if (!chapter) return null;
  const novel = await db.prepare("SELECT * FROM novel WHERE id = ?").get(chapter.novelId) as Novel;
  const volumes = await db.prepare("SELECT * FROM volume WHERE novelId = ? ORDER BY number").all(novel.id) as Volume[];
  return { chapter, novel, volumes };
}

export async function getVolumeWithNovel(volumeId: number) {
  await connection();
  const volume = await db.prepare("SELECT * FROM volume WHERE id = ?").get(volumeId) as Volume | undefined;
  if (!volume) return null;
  const novel = await db.prepare("SELECT * FROM novel WHERE id = ?").get(volume.novelId) as Novel;
  const volumes = await db.prepare("SELECT * FROM volume WHERE novelId = ? ORDER BY number").all(novel.id) as Volume[];
  const { next } = (await db
    .prepare("SELECT COALESCE(MAX(position), 0) + 1 AS next FROM chapter WHERE volumeId = ?")
    .get<{ next: number }>(volume.id))!;
  // Un nouveau chapitre reprend la phase du dernier chapitre du tome.
  const last = await db.prepare("SELECT phase FROM chapter WHERE volumeId = ? ORDER BY position DESC, id DESC LIMIT 1").get<{ phase: string }>(volume.id);
  return { volume, novel, volumes, nextPosition: next, phase: last?.phase ?? "" };
}

// Phases déjà employées dans le novel, proposées à la saisie d’un chapitre.
export async function phasesOf(novelId: number) {
  const rows = await db.prepare("SELECT DISTINCT phase FROM chapter WHERE novelId = ? AND phase <> '' ORDER BY phase").all<{ phase: string }>(novelId);
  return rows.map((row) => row.phase);
}

export type VolumeIllustration = { src: string; alt: string; credit: string; chapter: { slug: string; heading: string } };

// Illustrations d’un tome, dans l’ordre de lecture : images Markdown des chapitres publiés,
// avec la ligne de crédit qui les suit éventuellement (« *Colorisation : X* »).
export async function getVolumeIllustrations(novelSlug: string, volumeNumber: number) {
  await connection();
  const novel = await db.prepare("SELECT * FROM novel WHERE slug = ?").get<Novel>(novelSlug);
  if (!novel) return null;
  const volume = await db.prepare("SELECT * FROM volume WHERE novelId = ? AND number = ?").get<Volume>(novel.id, volumeNumber);
  if (!volume) return null;
  const chapters = await db
    .prepare("SELECT slug, label, title, content FROM chapter WHERE volumeId = ? AND published = 1 ORDER BY position, id")
    .all<Pick<Chapter, "slug" | "label" | "title" | "content">>(volume.id);
  const images: VolumeIllustration[] = chapters.flatMap((chapter) =>
    // Crédit : ligne en italique de la forme « Rôle : Nom » (une dédicace en italique n’en est pas un).
    [...chapter.content.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)(?:[ \t]*\r?\n[ \t]*(?:\r?\n[ \t]*)?\*([^*\n]+ : [^*\n]+)\*)?/g)].map(([, alt, src, credit]) => ({
      src,
      alt,
      credit: credit?.trim() ?? "",
      chapter: { slug: chapter.slug, heading: chapterHeading(chapter) },
    })),
  );
  return { novel, volume, images };
}

// « Tome 1 » dans le tome 1 → tome-1 ; « Chapitre 3 » dans le tome 2 → tome-2-chapitre-3.
export async function uniqueChapterSlug(novelId: number, volumeNumber: number, label: string, excludeId = 0) {
  const prefix = `tome-${volumeNumber}`;
  const part = slugify(label) || "chapitre";
  const base = part === prefix || part.startsWith(`${prefix}-`) ? part : `${prefix}-${part}`;
  const taken = db.prepare("SELECT 1 FROM chapter WHERE novelId = ? AND slug = ? AND id != ?");
  let slug = base;
  for (let n = 2; await taken.get(novelId, slug, excludeId); n++) slug = `${base}-${n}`;
  return slug;
}
