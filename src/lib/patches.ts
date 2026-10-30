import "server-only";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { fileUrl } from "@/lib/file-url";
import type { PatchKind } from "@/lib/patch-kinds";
import { parseSteps, type ProgressStep } from "@/lib/progress-steps";
import { getViewer } from "@/lib/viewer";

export const STATUSES = ["En développement", "Alpha", "Bêta", "Stable", "Terminé", "Obsolète", "Abandonné"] as const;

export type PatchImage = {
  id: number;
  patchId: number;
  kind: "cover" | "screenshot" | "background" | "logo";
  file: string;
  alt: string;
  width: number;
  height: number;
  position: number;
};

export type Patch = {
  id: number;
  slug: string;
  title: string;
  description: string;
  status: string;
  progress: number;
  downloadUrl: string;
  progressSteps: string; // JSON, voir progress-steps.ts
  quote: string; // citation du carrousel « Recommandé »
  featured: number; // 1 : affiché dans le carrousel de l’accueil
  kind: PatchKind; // 'vn' ou 'jeu', voir patch-kinds.ts
  draft: number; // 1 : brouillon, invisible du public (voir isPublicPatch)
  steamAppId: number | null; // pour le launcher : détection du jeu installé
  gogId: number | null;
  vndbId: string; // « v12345 », ou vide
  youtubeId: string; // vidéo affichée sous les captures (opening, bande-annonce…), ou vide
  downloads: number; // téléchargements depuis la fiche (src/lib/stats.ts)
  createdAt: string;
  updatedAt: string;
};

export type PatchWithImages = Patch & {
  cover: PatchImage | null;
  // Image large affichée derrière l’en-tête de la fiche ; à défaut, la couverture floutée.
  background: PatchImage | null;
  // Logo (PNG détouré) affiché à droite dans le carrousel « Recommandé ».
  logo: PatchImage | null;
  screenshots: PatchImage[];
  steps: ProgressStep[];
};

export const imageUrl = (image: Pick<PatchImage, "file">) => fileUrl(image.file);

async function withImages(patch: Patch): Promise<PatchWithImages> {
  const images = await db
    .prepare("SELECT * FROM patch_image WHERE patchId = ? ORDER BY position, id")
    .all<PatchImage>(patch.id);
  return {
    ...patch,
    steps: parseSteps(patch.progressSteps),
    cover: images.find((image) => image.kind === "cover") ?? null,
    background: images.find((image) => image.kind === "background") ?? null,
    logo: images.find((image) => image.kind === "logo") ?? null,
    screenshots: images.filter((image) => image.kind === "screenshot"),
  };
}

// Patchs du carrousel « Recommandé » de l’accueil.
export async function listFeaturedPatches() {
  await connection();
  const patches = await db.prepare("SELECT * FROM patch WHERE featured = 1 AND draft = 0 ORDER BY updatedAt DESC, id DESC").all<Patch>();
  return Promise.all(patches.map(withImages));
}

// connection() empêche que ces lectures soient figées au build : la base change après le déploiement.
// Sans type : tous les patchs (VN et jeux). Par défaut, les patchs publics seulement ; `drafts: true` ajoute les
// brouillons (gestion).
export async function listPatches(kind?: PatchKind, { drafts = false }: { drafts?: boolean } = {}) {
  await connection();
  const where = [kind ? "kind = ?" : "", drafts ? "" : "draft = 0"].filter(Boolean);
  const patches = await db
    .prepare(`SELECT * FROM patch ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY updatedAt DESC, id DESC`)
    .all<Patch>(...(kind ? [kind] : []));
  return Promise.all(patches.map(withImages));
}

// Un brouillon n’est visible que par l’équipe : la fiche vérifie `canSeePatch` avant d’afficher.
export const isPublicPatch = (patch: Pick<Patch, "draft">) => Number(patch.draft) === 0;
export async function canSeePatch(patch: Pick<Patch, "draft">) {
  return isPublicPatch(patch) || Boolean((await getViewer())?.isTeam);
}

export async function getPatchBySlug(slug: string) {
  await connection();
  const patch = await db.prepare("SELECT * FROM patch WHERE slug = ?").get<Patch>(slug);
  return patch ? withImages(patch) : null;
}

export async function getPatchById(id: number) {
  await connection();
  const patch = await db.prepare("SELECT * FROM patch WHERE id = ?").get<Patch>(id);
  return patch ? withImages(patch) : null;
}

export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function uniqueSlug(title: string) {
  const base = slugify(title) || "patch";
  const taken = db.prepare("SELECT 1 FROM patch WHERE slug = ?");
  let slug = base;
  for (let n = 2; await taken.get(slug); n++) slug = `${base}-${n}`;
  return slug;
}

export function formatDate(value: string) {
  return new Date(value.replace(" ", "T") + "Z").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
