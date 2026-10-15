"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { isHttpUrl, teamActor, type ActionResult } from "@/lib/action-guard";
import { diff, logEntry } from "@/lib/activity";
import { db } from "@/lib/db";
import { LINK_KINDS, LINK_LABELS, uniqueMemberSlug, type LinkKind } from "@/lib/team";
import { removeFile } from "@/lib/uploads";

export type { ActionResult };

type MemberRow = { id: number; name: string; title: string; links: string; position: number; avatarFile: string };

const parseLinks = (json: string): Partial<Record<LinkKind, string>> => {
  try {
    return JSON.parse(json);
  } catch {
    return {};
  }
};

// Fiche d’un membre : nom, titre global facultatif (ex. Fondateur), ordre et liens.
// Ses rôles se règlent sur chaque patch (tableau « Équipe du patch » dans la gestion du patch).
export async function saveMember(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;

  const name = String(formData.get("name") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const position = Number(formData.get("position"));
  if (!name || name.length > 80) return { error: "Le nom est requis (80 caractères maximum)." };
  if (title.length > 60) return { error: "Le titre est trop long (60 caractères maximum)." };
  if (!Number.isInteger(position) || position < 0) return { error: "L’ordre doit être un entier positif." };

  const links: Partial<Record<LinkKind, string>> = {};
  for (const kind of LINK_KINDS) {
    const url = String(formData.get(`link_${kind}`) ?? "").trim();
    if (!url) continue;
    if (!isHttpUrl(url)) return { error: `Le lien ${LINK_LABELS[kind]} doit commencer par http:// ou https://.` };
    links[kind] = url;
  }

  const id = Number(formData.get("id")) || null;
  if (id === null) {
    const [created] = await db.batch([
      {
        sql: "INSERT INTO team_member (slug, name, title, links, position) VALUES (?, ?, ?, ?, ?)",
        args: [await uniqueMemberSlug(name), name, title, JSON.stringify(links), position],
      },
      logEntry(actor, { type: "member", id: "last", label: name, action: "create" }),
    ]);
    redirect(`/gestion/equipe/${created.lastInsertRowid}?cree=1`);
  }

  const before = await db.prepare("SELECT * FROM team_member WHERE id = ?").get<MemberRow>(id);
  if (!before) return { error: "Membre introuvable." };
  const oldLinks = parseLinks(before.links);
  // Le slug (ancre /equipe#slug) ne change pas quand le nom change : les liens existants restent valides.
  await db.batch([
    { sql: "UPDATE team_member SET name = ?, title = ?, links = ?, position = ? WHERE id = ?", args: [name, title, JSON.stringify(links), position, id] },
    logEntry(actor, {
      type: "member",
      id,
      label: name,
      action: "update",
      changes: diff([
        { label: "Nom", before: before.name, after: name },
        { label: "Titre", before: before.title, after: title },
        { label: "Ordre", before: before.position, after: position },
        ...LINK_KINDS.map((kind) => ({ label: `Lien ${LINK_LABELS[kind]}`, before: oldLinks[kind] ?? "", after: links[kind] ?? "" })),
      ]),
    }),
  ]);
  refresh();
  return { savedAt: Date.now() };
}

export async function deleteMember(id: number): Promise<ActionResult> {
  const actor = await teamActor();
  if ("error" in actor) return actor;
  const member = await db.prepare("SELECT name, avatarFile FROM team_member WHERE id = ?").get<{ name: string; avatarFile: string }>(id);
  if (!member) return { error: "Membre introuvable." };
  // Le membre disparaît aussi des fiches où il était indiqué comme participant.
  await db.batch([
    { sql: "DELETE FROM patch_member_role WHERE memberId = ?", args: [id] },
    { sql: "DELETE FROM patch_member WHERE memberId = ?", args: [id] },
    { sql: "DELETE FROM novel_member_role WHERE memberId = ?", args: [id] },
    { sql: "DELETE FROM novel_member WHERE memberId = ?", args: [id] },
    { sql: "DELETE FROM team_member WHERE id = ?", args: [id] },
    logEntry(actor, { type: "member", id, label: member.name, action: "delete" }),
  ]);
  await removeFile(member.avatarFile);
  redirect("/gestion?onglet=equipe");
}
