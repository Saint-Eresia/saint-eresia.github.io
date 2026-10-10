import "server-only";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { parseSteps, type ProgressStep } from "@/lib/progress-steps";

export const STATUSES = ["En développement", "Alpha", "Bêta", "Stable", "Terminé", "Obsolète", "Abandonné"] as const;

export type PatchImage = {
  id: number;
  patchId: number;
  kind: "cover" | "screenshot";
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
  createdAt: string;
  updatedAt: string;
};

export type PatchWithImages = Patch & { cover: PatchImage | null; screenshots: PatchImage[]; steps: ProgressStep[] };

export const imageUrl = (image: Pick<PatchImage, "file">) => `/uploads/${image.file}`;

function withImages(patch: Patch): PatchWithImages {
  const images = db
    .prepare("SELECT * FROM patch_image WHERE patchId = ? ORDER BY position, id")
    .all(patch.id) as PatchImage[];
  return {
    ...patch,
    steps: parseSteps(patch.progressSteps),
    cover: images.find((image) => image.kind === "cover") ?? null,
    screenshots: images.filter((image) => image.kind === "screenshot"),
  };
}

// better-sqlite3 est synchrone : connection() empêche que ces lectures soient figées au build.
export async function listPatches() {
  await connection();
  const patches = db.prepare("SELECT * FROM patch ORDER BY updatedAt DESC, id DESC").all() as Patch[];
  return patches.map(withImages);
}

export async function getPatchBySlug(slug: string) {
  await connection();
  const patch = db.prepare("SELECT * FROM patch WHERE slug = ?").get(slug) as Patch | undefined;
  return patch ? withImages(patch) : null;
}

export async function getPatchById(id: number) {
  await connection();
  const patch = db.prepare("SELECT * FROM patch WHERE id = ?").get(id) as Patch | undefined;
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

export function uniqueSlug(title: string) {
  const base = slugify(title) || "patch";
  const taken = db.prepare("SELECT 1 FROM patch WHERE slug = ?");
  let slug = base;
  for (let n = 2; taken.get(slug); n++) slug = `${base}-${n}`;
  return slug;
}

export function formatDate(value: string) {
  return new Date(value.replace(" ", "T") + "Z").toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
