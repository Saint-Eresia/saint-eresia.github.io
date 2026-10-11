"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { guard, isHttpUrl, type ActionResult } from "@/lib/action-guard";
import { db } from "@/lib/db";
import { LINK_KINDS, LINK_LABELS, uniqueMemberSlug } from "@/lib/team";
import { removeFile } from "@/lib/uploads";

export type { ActionResult };

// Fiche d’un membre : nom, titre global facultatif (ex. Fondateur), ordre et liens.
// Ses rôles se règlent sur chaque patch (tableau « Équipe du patch » dans la gestion du patch).
export async function saveMember(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;

  const name = String(formData.get("name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const position = Number(formData.get("position"));
  if (!name || name.length > 80) return { error: "Le nom est requis (80 caractères maximum)." };
  if (title.length > 60) return { error: "Le titre est trop long (60 caractères maximum)." };
  if (!Number.isInteger(position) || position < 0) return { error: "L’ordre doit être un entier positif." };

  const links: Record<string, string> = {};
  for (const kind of LINK_KINDS) {
    const url = String(formData.get(`link_${kind}`) ?? "").trim();
    if (!url) continue;
    if (!isHttpUrl(url)) return { error: `Le lien ${LINK_LABELS[kind]} doit commencer par http:// ou https://.` };
    links[kind] = url;
  }

  const id = Number(formData.get("id")) || null;
  if (id === null) {
    const { lastInsertRowid } = await db
      .prepare("INSERT INTO team_member (slug, name, title, links, position) VALUES (?, ?, ?, ?, ?)")
      .run(await uniqueMemberSlug(name), name, title, JSON.stringify(links), position);
    redirect(`/gestion/equipe/${lastInsertRowid}?cree=1`);
  }
  // Le slug (ancre /equipe#slug) ne change pas quand le nom change : les liens existants restent valides.
  const { changes } = await db
    .prepare("UPDATE team_member SET name = ?, title = ?, links = ?, position = ? WHERE id = ?")
    .run(name, title, JSON.stringify(links), position, id);
  if (!changes) return { error: "Membre introuvable." };
  refresh();
  return { savedAt: Date.now() };
}

export async function deleteMember(id: number): Promise<ActionResult> {
  const denied = await guard();
  if (denied) return denied;
  const member = await db.prepare("SELECT avatarFile FROM team_member WHERE id = ?").get<{ avatarFile: string }>(id);
  if (!member) return { error: "Membre introuvable." };
  // Le membre disparaît aussi des fiches où il était indiqué comme participant.
  await db.batch([
    { sql: "DELETE FROM patch_member_role WHERE memberId = ?", args: [id] },
    { sql: "DELETE FROM patch_member WHERE memberId = ?", args: [id] },
    { sql: "DELETE FROM novel_member WHERE memberId = ?", args: [id] },
    { sql: "DELETE FROM team_member WHERE id = ?", args: [id] },
  ]);
  await removeFile(member.avatarFile);
  redirect("/gestion");
}
