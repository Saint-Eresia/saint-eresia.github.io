"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { guard, isHttpUrl, type ActionResult } from "@/lib/action-guard";
import { db } from "@/lib/db";
import { LINK_KINDS, LINK_LABELS, splitLines } from "@/lib/team";
import { removeFile } from "@/lib/uploads";

export type { ActionResult };

export async function saveMember(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const name = String(formData.get("name") ?? "").trim();
  const roles = splitLines(String(formData.get("roles") ?? ""));
  const projects = splitLines(String(formData.get("projects") ?? ""));
  const position = Number(formData.get("position"));
  if (!name || name.length > 80) return { error: "Le nom est requis (80 caractères maximum)." };
  if (roles.length > 15 || projects.length > 30) return { error: "Trop de rôles ou de projets." };
  if (!Number.isInteger(position) || position < 0) return { error: "L’ordre doit être un entier positif." };

  const links: Record<string, string> = {};
  for (const kind of LINK_KINDS) {
    const url = String(formData.get(`link_${kind}`) ?? "").trim();
    if (!url) continue;
    if (!isHttpUrl(url)) return { error: `Le lien ${LINK_LABELS[kind]} doit commencer par http:// ou https://.` };
    links[kind] = url;
  }

  const values = [name, roles.join("\n"), projects.join("\n"), JSON.stringify(links), position];
  const id = Number(formData.get("id")) || null;
  if (id === null) {
    const { lastInsertRowid } = await db
      .prepare("INSERT INTO team_member (name, roles, projects, links, position) VALUES (?, ?, ?, ?, ?)")
      .run(...values);
    redirect(`/gestion/equipe/${lastInsertRowid}?cree=1`);
  }
  const { changes } = await db
    .prepare("UPDATE team_member SET name = ?, roles = ?, projects = ?, links = ?, position = ? WHERE id = ?")
    .run(...values, id);
  if (!changes) return { error: "Membre introuvable." };

  // Section « Rôles par VN » : seuls les patchs auxquels le membre participe déjà sont mis à jour.
  const patchRoles = [...formData.entries()].flatMap(([key, value]) => {
    const match = /^patchRole_(\d+)$/.exec(key);
    return match ? [{ patchId: Number(match[1]), role: String(value).trim() }] : [];
  });
  if (patchRoles.some((vn) => vn.role.length > 80)) return { error: "Un rôle par VN ne doit pas dépasser 80 caractères." };
  if (patchRoles.length) {
    await db.batch(
      patchRoles.map((vn) => ({
        sql: "UPDATE patch_member SET role = ? WHERE patchId = ? AND memberId = ?",
        args: [vn.role, vn.patchId, id],
      })),
    );
  }
  refresh();
  return { savedAt: Date.now() };
}

export async function deleteMember(id: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const member = await db.prepare("SELECT avatarFile FROM team_member WHERE id = ?").get(id) as { avatarFile: string } | undefined;
  if (!member) return { error: "Membre introuvable." };
  // Le membre disparaît aussi des fiches où il était indiqué comme participant.
  await db.batch([
    { sql: "DELETE FROM patch_member WHERE memberId = ?", args: [id] },
    { sql: "DELETE FROM novel_member WHERE memberId = ?", args: [id] },
    { sql: "DELETE FROM team_member WHERE id = ?", args: [id] },
  ]);
  await removeFile(member.avatarFile);
  redirect("/gestion");
}
