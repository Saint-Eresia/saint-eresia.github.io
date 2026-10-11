"use server";

import type { InStatement } from "@libsql/client";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { teamActor, type ActionResult } from "@/lib/action-guard";
import { diff, logEntry, type Actor, type Change } from "@/lib/activity";
import { db } from "@/lib/db";
import { STATUSES, uniqueSlug, type Patch, type PatchImage } from "@/lib/patches";
import { isPatchKind, PATCH_KINDS } from "@/lib/patch-kinds";
import { averageProgress, MAX_STEPS, parseSteps, type ProgressStep } from "@/lib/progress-steps";
import { isRoleKey, ROLE_LABELS, sortRoles, type RoleKey } from "@/lib/roles";
import { setPatchTeam, type PatchTeamEntry } from "@/lib/team";
import { IMAGE_KIND_LABELS, removeFile } from "@/lib/uploads";

export type { ActionResult };

const touch = (patchId: number): InStatement => ({ sql: "UPDATE patch SET updatedAt = datetime('now') WHERE id = ?", args: [patchId] });

// Modification d’un patch : la modification, la date de mise à jour et le journal, en une seule transaction.
async function commitUpdate(actor: Actor, patch: Pick<Patch, "id" | "title">, statements: InStatement[], changes: Change[]) {
  await db.batch([...statements, touch(patch.id), logEntry(actor, { type: "patch", id: patch.id, label: patch.title, action: "update", changes })]);
  refresh();
  return { savedAt: Date.now() };
}

const findPatch = (id: number) => db.prepare("SELECT * FROM patch WHERE id = ?").get<Patch>(id);

function readPatchForm(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const status = String(formData.get("status") ?? "");
  const manualProgress = Number(formData.get("progress"));
  const downloadUrl = String(formData.get("downloadUrl") ?? "").trim();
  const quote = String(formData.get("quote") ?? "").trim();
  const featured = formData.get("featured") === "1" ? 1 : 0;
  const kind = String(formData.get("kind") ?? "vn");
  if (!isPatchKind(kind)) return { error: "Rubrique invalide." };
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

  return { data: { title, description, status, progress, downloadUrl, steps, progressSteps: JSON.stringify(steps), quote, featured, kind } };
}

// Étapes d’avancement : « Avancement Traduction : 90 % → 100 % », étape ajoutée ou retirée.
function stepChanges(before: ProgressStep[], after: ProgressStep[]): Change[] {
  const old = new Map(before.map((step) => [step.label, step.value]));
  const now = new Map(after.map((step) => [step.label, step.value]));
  const labels = [...new Set([...old.keys(), ...now.keys()])];
  return labels.flatMap((label) => {
    const [b, a] = [old.get(label), now.get(label)];
    if (b === a) return [];
    return [{ field: `Avancement ${label}`, before: b === undefined ? "(absente)" : `${b} %`, after: a === undefined ? "(retirée)" : `${a} %` }];
  });
}

export async function savePatch(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;

  const parsed = readPatchForm(formData);
  if (parsed.error) return { error: parsed.error };
  const { title, description, status, progress, downloadUrl, steps, progressSteps, quote, featured, kind } = parsed.data!;
  const id = Number(formData.get("id")) || null;

  if (id === null) {
    const [created] = await db.batch([
      {
        sql: "INSERT INTO patch (slug, title, description, status, progress, downloadUrl, progressSteps, quote, featured, kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [await uniqueSlug(title), title, description, status, progress, downloadUrl, progressSteps, quote, featured, kind],
      },
      logEntry(actor, { type: "patch", id: "last", label: title, action: "create" }),
    ]);
    redirect(`/gestion/patchs/${created.lastInsertRowid}?cree=1`);
  }

  const before = await findPatch(id);
  if (!before) return { error: "Patch introuvable." };
  const changes = [
    ...diff([
      { label: "Titre", before: before.title, after: title },
      { label: "Rubrique", before: PATCH_KINDS[isPatchKind(before.kind) ? before.kind : "vn"].plural, after: PATCH_KINDS[kind].plural },
      { label: "Statut", before: before.status, after: status },
      { label: "Avancement global", before: `${before.progress} %`, after: `${progress} %` },
    ]),
    ...stepChanges(parseSteps(before.progressSteps), steps),
    ...diff([
      { label: "Lien de téléchargement", before: before.downloadUrl, after: downloadUrl },
      { label: "Citation", before: before.quote, after: quote },
      { label: "Recommandé sur l’accueil", before: before.featured ? "Oui" : "Non", after: featured ? "Oui" : "Non" },
      { label: "Description", before: before.description, after: description, long: true },
    ]),
  ];
  return commitUpdate(
    actor,
    { id, title },
    [
      {
        sql: "UPDATE patch SET title = ?, description = ?, status = ?, progress = ?, downloadUrl = ?, progressSteps = ?, quote = ?, featured = ?, kind = ? WHERE id = ?",
        args: [title, description, status, progress, downloadUrl, progressSteps, quote, featured, kind, id],
      },
    ],
    changes,
  );
}

// Équipe du patch : ses membres et leurs rôles (liste fixe), affichés sur la fiche et la page Équipe.
export async function savePatchTeam(patchId: number, entries: PatchTeamEntry[]): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;
  const patch = await findPatch(patchId);
  if (!patch) return { error: "Patch introuvable." };
  if (!Array.isArray(entries) || entries.length > 100) return { error: "Équipe invalide." };
  const clean = entries.map((entry) => ({
    memberId: Number(entry?.memberId),
    roles: (Array.isArray(entry?.roles) ? entry.roles : []).filter((role): role is RoleKey => typeof role === "string" && isRoleKey(role)),
  }));
  if (clean.some((entry) => !Number.isInteger(entry.memberId))) return { error: "Membre invalide." };

  // Journal : un changement par membre ajouté, retiré, ou dont les rôles changent.
  const names = new Map(
    (await db.prepare("SELECT id, name FROM team_member").all<{ id: number; name: string }>()).map((m) => [Number(m.id), String(m.name)]),
  );
  const beforeRows = await db
    .prepare("SELECT l.memberId, r.role FROM patch_member l LEFT JOIN patch_member_role r ON r.patchId = l.patchId AND r.memberId = l.memberId WHERE l.patchId = ?")
    .all<{ memberId: number; role: string | null }>(patchId);
  const before = new Map<number, RoleKey[]>();
  for (const row of beforeRows) {
    const list = before.get(Number(row.memberId)) ?? [];
    if (row.role && isRoleKey(row.role)) list.push(row.role);
    before.set(Number(row.memberId), list);
  }
  const after = new Map(clean.filter((entry) => names.has(entry.memberId)).map((entry) => [entry.memberId, entry.roles]));
  const describe = (roles: RoleKey[] | undefined) =>
    roles === undefined ? "(absent)" : sortRoles(roles).map((role) => ROLE_LABELS[role]).join(", ") || "(aucun rôle)";
  const changes = [...new Set([...before.keys(), ...after.keys()])].flatMap((memberId) => {
    const [b, a] = [describe(before.get(memberId)), describe(after.get(memberId))];
    return b === a ? [] : [{ field: `Équipe : ${names.get(memberId) ?? `membre ${memberId}`}`, before: b, after: a }];
  });

  await setPatchTeam(patchId, clean, [
    touch(patchId),
    logEntry(actor, { type: "patch", id: patchId, label: patch.title, action: "update", changes }),
  ]);
  refresh();
  return { savedAt: Date.now() };
}

export async function deletePatch(patchId: number): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;
  const patch = await findPatch(patchId);
  if (!patch) return { error: "Patch introuvable." };

  const images = await db.prepare("SELECT file FROM patch_image WHERE patchId = ?").all<{ file: string }>(patchId);
  await db.batch([
    { sql: "DELETE FROM patch_member_role WHERE patchId = ?", args: [patchId] },
    { sql: "DELETE FROM patch_member WHERE patchId = ?", args: [patchId] },
    { sql: "DELETE FROM patch_image WHERE patchId = ?", args: [patchId] },
    { sql: "DELETE FROM patch WHERE id = ?", args: [patchId] },
    logEntry(actor, { type: "patch", id: patchId, label: patch.title, action: "delete" }),
  ]);
  await Promise.all(images.map((image) => removeFile(image.file)));
  redirect(`/gestion?onglet=${PATCH_KINDS[isPatchKind(patch.kind) ? patch.kind : "vn"].tab}`);
}

export async function updateImageAlt(imageId: number, alt: string): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;

  const text = alt.trim().slice(0, 300);
  const image = await db.prepare("SELECT * FROM patch_image WHERE id = ?").get<PatchImage>(imageId);
  if (!image) return { error: "Image introuvable." };
  const patch = (await findPatch(image.patchId))!;
  return commitUpdate(
    actor,
    patch,
    [{ sql: "UPDATE patch_image SET alt = ? WHERE id = ?", args: [text, imageId] }],
    diff([{ label: `Texte alternatif (${IMAGE_KIND_LABELS[image.kind]})`, before: image.alt, after: text }]),
  );
}

export async function reorderScreenshots(patchId: number, orderedIds: number[]): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;
  const patch = await findPatch(patchId);
  if (!patch) return { error: "Patch introuvable." };

  const current = await db
    .prepare("SELECT id FROM patch_image WHERE patchId = ? AND kind = 'screenshot' ORDER BY position, id")
    .all<{ id: number }>(patchId);
  const known = new Set(current.map((row) => Number(row.id)));
  if (orderedIds.length !== known.size || !orderedIds.every((id) => known.has(id))) {
    return { error: "L’ordre envoyé ne correspond pas aux images du patch. Rechargez la page." };
  }
  const position = (ids: number[]) => ids.map((id) => current.findIndex((row) => Number(row.id) === id) + 1).join(", ");
  return commitUpdate(
    actor,
    patch,
    orderedIds.map((id, index) => ({ sql: "UPDATE patch_image SET position = ? WHERE id = ?", args: [index, id] })),
    [{ field: "Ordre des captures d’écran", before: position(current.map((row) => Number(row.id))), after: position(orderedIds) }],
  );
}

export async function deleteImage(imageId: number): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;

  const image = await db.prepare("SELECT * FROM patch_image WHERE id = ?").get<PatchImage>(imageId);
  if (!image) return { error: "Image introuvable." };
  const patch = (await findPatch(image.patchId))!;
  const result = await commitUpdate(
    actor,
    patch,
    [{ sql: "DELETE FROM patch_image WHERE id = ?", args: [imageId] }],
    [{ field: IMAGE_KIND_LABELS[image.kind], before: image.alt || "image", after: "(supprimée)" }],
  );
  await removeFile(image.file);
  return result;
}
