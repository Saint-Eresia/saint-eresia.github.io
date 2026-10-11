import "server-only";
import type { InStatement } from "@libsql/client";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { isRoleKey, ROLE_LABELS, sortRoles, type RoleKey } from "@/lib/roles";
import type { LinkKind } from "@/lib/team-links";

export { LINK_KINDS, LINK_LABELS, type LinkKind } from "@/lib/team-links";

// roles / projects : anciennes listes en texte libre, conservées en base mais plus affichées
// (les rôles sont désormais attachés à un couple membre-patch, table patch_member_role).
type Row = {
  id: number;
  slug: string;
  name: string;
  title: string;
  avatarFile: string;
  roles: string;
  projects: string;
  links: string;
  position: number;
};
export type TeamMember = Omit<Row, "roles" | "projects" | "links"> & {
  links: Partial<Record<LinkKind, string>>;
};

export const splitLines = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);

function parse(row: Row): TeamMember {
  let links: TeamMember["links"] = {};
  try {
    links = JSON.parse(row.links);
  } catch {}
  return {
    id: Number(row.id),
    slug: String(row.slug ?? ""),
    name: String(row.name),
    title: String(row.title ?? ""),
    avatarFile: String(row.avatarFile),
    position: Number(row.position),
    links,
  };
}

// Ancre de la page Équipe : /equipe#mekki (stable, ne dépend pas de l’ordre ni de l’identifiant).
export const memberAnchor = (member: Pick<TeamMember, "slug" | "id">) => member.slug || `membre-${member.id}`;

export async function listTeam() {
  await connection();
  return (await db.prepare("SELECT * FROM team_member ORDER BY position, id").all<Row>()).map(parse);
}

export async function getMember(id: number) {
  await connection();
  const row = await db.prepare("SELECT * FROM team_member WHERE id = ?").get<Row>(id);
  return row ? parse(row) : null;
}

// ——— Rôles par patch ———

const rolesByMember = (rows: { memberId: number; role: string }[]) => {
  const map = new Map<number, RoleKey[]>();
  for (const row of rows) {
    if (!isRoleKey(row.role)) continue;
    const list = map.get(Number(row.memberId)) ?? [];
    list.push(row.role);
    map.set(Number(row.memberId), list);
  }
  return map;
};

// Équipe d’un patch : ses membres (ordre de la page Équipe) et leurs rôles sur ce patch.
export async function listPatchTeam(patchId: number) {
  await connection();
  const [members, roles] = await Promise.all([
    db
      .prepare("SELECT m.* FROM team_member m JOIN patch_member l ON l.memberId = m.id WHERE l.patchId = ? ORDER BY m.position, m.id")
      .all<Row>(patchId),
    db.prepare("SELECT memberId, role FROM patch_member_role WHERE patchId = ?").all<{ memberId: number; role: string }>(patchId),
  ]);
  const byMember = rolesByMember(roles);
  return members.map((row) => {
    const member = parse(row);
    return { ...member, roles: sortRoles(byMember.get(member.id) ?? []) };
  });
}

// Page Équipe : pour chaque membre, ses patchs (ordre alphabétique) et ses rôles sur chacun.
export async function listTeamPatchRoles() {
  await connection();
  const [links, roles] = await Promise.all([
    db
      .prepare(
        `SELECT l.memberId, p.id AS patchId, p.slug, p.title, p.kind FROM patch_member l JOIN patch p ON p.id = l.patchId
         ORDER BY p.title COLLATE NOCASE`,
      )
      .all<{ memberId: number; patchId: number; slug: string; title: string; kind: string }>(),
    db.prepare("SELECT patchId, memberId, role FROM patch_member_role").all<{ patchId: number; memberId: number; role: string }>(),
  ]);
  const result = new Map<number, { patchId: number; slug: string; kind: string; title: string; roles: RoleKey[] }[]>();
  for (const link of links) {
    const keys = roles
      .filter((r) => Number(r.patchId) === Number(link.patchId) && Number(r.memberId) === Number(link.memberId))
      .map((r) => r.role)
      .filter(isRoleKey);
    const list = result.get(Number(link.memberId)) ?? [];
    list.push({ patchId: Number(link.patchId), slug: String(link.slug), kind: String(link.kind), title: String(link.title), roles: sortRoles(keys) });
    result.set(Number(link.memberId), list);
  }
  return result;
}

export type PatchTeamEntry = { memberId: number; roles: RoleKey[] };

// Remplace l’équipe d’un patch (membres et rôles) en une seule transaction. Membres et rôles inconnus ignorés.
// `extra` : instructions ajoutées à la même transaction (date de mise à jour, journal d’activité).
export async function setPatchTeam(patchId: number, entries: PatchTeamEntry[], extra: InStatement[] = []) {
  const known = new Set((await db.prepare("SELECT id FROM team_member").all<{ id: number }>()).map((row) => Number(row.id)));
  const seen = new Set<number>();
  const clean = entries.filter((entry) => known.has(entry.memberId) && !seen.has(entry.memberId) && seen.add(entry.memberId));
  const ids = clean.map((entry) => entry.memberId);
  await db.batch([
    { sql: "DELETE FROM patch_member_role WHERE patchId = ?", args: [patchId] },
    {
      sql: `DELETE FROM patch_member WHERE patchId = ? AND memberId NOT IN (${ids.map(() => "?").join(", ")})`,
      args: [patchId, ...ids],
    },
    ...clean.flatMap((entry) => [
      { sql: "INSERT OR IGNORE INTO patch_member (patchId, memberId) VALUES (?, ?)", args: [patchId, entry.memberId] },
      ...sortRoles(entry.roles.filter(isRoleKey)).map((role) => ({
        sql: "INSERT INTO patch_member_role (patchId, memberId, role) VALUES (?, ?, ?)",
        args: [patchId, entry.memberId, role],
      })),
    ]),
    ...extra,
  ]);
}

// ——— Participants des novels (sans rôle par projet) ———

export async function listNovelMembers(novelId: number) {
  await connection();
  const rows = await db
    .prepare("SELECT m.* FROM team_member m JOIN novel_member l ON l.memberId = m.id WHERE l.novelId = ? ORDER BY m.position, m.id")
    .all<Row>(novelId);
  return rows.map((row) => ({ ...parse(row), roles: [] as RoleKey[] }));
}

export async function listNovelMemberIds(novelId: number) {
  await connection();
  const rows = await db.prepare("SELECT memberId FROM novel_member WHERE novelId = ?").all<{ memberId: number }>(novelId);
  return rows.map((row) => Number(row.memberId));
}

// Remplace la liste des participants d’un novel (identifiants inconnus ignorés), en une seule transaction.
// `extra` : instructions ajoutées à la même transaction (date de mise à jour, journal d’activité).
export async function setNovelMembers(novelId: number, memberIds: number[], extra: InStatement[] = []) {
  const known = new Set((await db.prepare("SELECT id FROM team_member").all<{ id: number }>()).map((row) => Number(row.id)));
  const ids = [...new Set(memberIds)].filter((memberId) => known.has(memberId));
  await db.batch([
    { sql: `DELETE FROM novel_member WHERE novelId = ? AND memberId NOT IN (${ids.map(() => "?").join(", ")})`, args: [novelId, ...ids] },
    ...ids.map((memberId) => ({ sql: "INSERT OR IGNORE INTO novel_member (novelId, memberId) VALUES (?, ?)", args: [novelId, memberId] })),
    ...extra,
  ]);
}

export const roleLabels = (keys: RoleKey[]) => keys.map((key) => ROLE_LABELS[key]);

// Slug d’un nouveau membre, unique ; il ne change plus ensuite (les liens /equipe#slug restent valides).
export async function uniqueMemberSlug(name: string) {
  const base =
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "membre";
  const taken = db.prepare("SELECT 1 FROM team_member WHERE slug = ?");
  let slug = base;
  for (let n = 2; await taken.get(slug); n++) slug = `${base}-${n}`;
  return slug;
}
