"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { STATUSES, uniqueSlug, type PatchImage } from "@/lib/patches";
import { removeFile } from "@/lib/uploads";
import { guard, type ActionResult } from "@/lib/action-guard";
import { isRoleKey } from "@/lib/roles";
import { setPatchTeam, type PatchTeamEntry } from "@/lib/team";
import { averageProgress, MAX_STEPS, parseSteps, type ProgressStep } from "@/lib/progress-steps";

export type { ActionResult };

// Date la modification et rafraîchit la page affichée.
async function changed(patchId: number): Promise<ActionResult> {
  await db.prepare("UPDATE patch SET updatedAt = datetime('now') WHERE id = ?").run(patchId);
  refresh();
  return { savedAt: Date.now() };
}

function readPatchForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const status = String(formData.get("status") ?? "");
  const manualProgress = Number(formData.get("progress"));
  const downloadUrl = String(formData.get("downloadUrl") ?? "").trim();
  const quote = String(formData.get("quote") ?? "").trim();
  const featured = formData.get("featured") === "1" ? 1 : 0;
  if (quote.length > 120) return { error: "La citation est trop longue (120 caractères maximum)." };

  if (!title || title.length > 180) return { error: "Le titre est requis (180 caractères maximum)." };
  if (description.length > 20_000) return { error: "La description est trop longue (20 000 caractères maximum)." };
  if (!(STATUSES as readonly string[]).includes(status)) return { error: "Statut invalide." };
  if (!Number.isInteger(manualProgress) || manualProgress < 0 || manualProgress > 100) return { error: "L’avancement doit être un entier entre 0 et 100." };
  if (downloadUrl && !/^https?:\/\/\S+$/i.test(downloadUrl)) return { error: "Le lien de téléchargement doit commencer par http:// ou https://." };

  // Avancement détaillé : s’il y a des catégories, l’avancement global en est la moyenne.
  const raw = parseSteps(String(formData.get("progressSteps") ?? "[]"));
  if (raw.length > MAX_STEPS) return { error: `${MAX_STEPS} catégories d’avancement au maximum.` };
  const steps: ProgressStep[] = [];
  for (const step of raw) {
    const label = String(step?.label ?? "").trim();
    const value = Number(step?.value);
    if (!label || label.length > 60) return { error: "Chaque catégorie d’avancement doit avoir un nom (60 caractères maximum)." };
    if (!Number.isInteger(value) || value < 0 || value > 100) return { error: `L’avancement « ${label} » doit être entre 0 et 100.` };
    steps.push({ label, value });
  }
  const progress = steps.length ? averageProgress(steps) : manualProgress;

  return { data: { title, description, status, progress, downloadUrl, progressSteps: JSON.stringify(steps), quote, featured } };
}

export async function savePatch(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const parsed = readPatchForm(formData);
  if (parsed.error) return { error: parsed.error };
  const { title, description, status, progress, downloadUrl, progressSteps, quote, featured } = parsed.data!;
  const id = Number(formData.get("id")) || null;

  if (id === null) {
    const { lastInsertRowid } = await db
      .prepare(
        "INSERT INTO patch (slug, title, description, status, progress, downloadUrl, progressSteps, quote, featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(await uniqueSlug(title), title, description, status, progress, downloadUrl, progressSteps, quote, featured);
    redirect(`/gestion/patchs/${lastInsertRowid}?cree=1`);
  }

  const { changes } = await db
    .prepare(
      "UPDATE patch SET title = ?, description = ?, status = ?, progress = ?, downloadUrl = ?, progressSteps = ?, quote = ?, featured = ?, updatedAt = datetime('now') WHERE id = ?",
    )
    .run(title, description, status, progress, downloadUrl, progressSteps, quote, featured, id);
  if (!changes) return { error: "Patch introuvable." };
  refresh();
  return { savedAt: Date.now() };
}

// Équipe du patch : ses membres et leurs rôles (liste fixe), affichés sur la fiche et la page Équipe.
export async function savePatchTeam(patchId: number, entries: PatchTeamEntry[]): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  if (!(await db.prepare("SELECT 1 FROM patch WHERE id = ?").get(patchId))) return { error: "Patch introuvable." };
  if (!Array.isArray(entries) || entries.length > 100) return { error: "Équipe invalide." };
  const clean = entries.map((entry) => ({
    memberId: Number(entry?.memberId),
    roles: (Array.isArray(entry?.roles) ? entry.roles : []).filter((role) => typeof role === "string" && isRoleKey(role)),
  }));
  if (clean.some((entry) => !Number.isInteger(entry.memberId))) return { error: "Membre invalide." };
  await setPatchTeam(patchId, clean);
  return await changed(patchId);
}

export async function deletePatch(patchId: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const images = await db.prepare("SELECT file FROM patch_image WHERE patchId = ?").all<{ file: string }>(patchId);
  await db.prepare("DELETE FROM patch_member_role WHERE patchId = ?").run(patchId);
  await db.prepare("DELETE FROM patch_member WHERE patchId = ?").run(patchId);
  await db.prepare("DELETE FROM patch WHERE id = ?").run(patchId); // les images suivent (ON DELETE CASCADE)
  await Promise.all(images.map((image) => removeFile(image.file)));
  redirect("/gestion");
}

export async function updateImageAlt(imageId: number, alt: string): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const text = alt.trim().slice(0, 300);
  const image = await db.prepare("SELECT patchId FROM patch_image WHERE id = ?").get(imageId) as { patchId: number } | undefined;
  if (!image) return { error: "Image introuvable." };
  await db.prepare("UPDATE patch_image SET alt = ? WHERE id = ?").run(text, imageId);
  return await changed(image.patchId);
}

export async function reorderScreenshots(patchId: number, orderedIds: number[]): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const current = await db
    .prepare("SELECT id FROM patch_image WHERE patchId = ? AND kind = 'screenshot'")
    .all(patchId) as { id: number }[];
  const known = new Set(current.map((row) => row.id));
  if (orderedIds.length !== known.size || !orderedIds.every((id) => known.has(id))) {
    return { error: "L’ordre envoyé ne correspond pas aux images du patch. Rechargez la page." };
  }
  await db.batch(
    orderedIds.map((id, index) => ({ sql: "UPDATE patch_image SET position = ? WHERE id = ?", args: [index, id] })),
  );
  return await changed(patchId);
}

export async function deleteImage(imageId: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const image = await db.prepare("SELECT * FROM patch_image WHERE id = ?").get(imageId) as PatchImage | undefined;
  if (!image) return { error: "Image introuvable." };
  await db.prepare("DELETE FROM patch_image WHERE id = ?").run(imageId);
  await removeFile(image.file);
  return await changed(image.patchId);
}
