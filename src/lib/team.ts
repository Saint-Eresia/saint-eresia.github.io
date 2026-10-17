import "server-only";
import type { InStatement } from "@libsql/client";
import { connection } from "next/server";
import { db } from "@/lib/db";
import type { Change } from "@/lib/activity";
import { patchHref } from "@/lib/patch-kinds";
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

// Équipe d’un projet (patch ou novel) : table des participants et table des rôles.
const PROJECTS = {
  patch: { table: "patch", members: "patch_member", roles: "patch_member_role", owner: "patchId", edit: "/gestion/patchs", anchor: "equipe-patch" },
  novel: { table: "novel", members: "novel_member", roles: "novel_member_role", owner: "novelId", edit: "/gestion/novels", anchor: "equipe-novel" },
} as const;
export type ProjectType = keyof typeof PROJECTS;

// Équipe d’un projet : ses membres (ordre de la page Équipe) et leurs rôles sur ce projet.
export async function listProjectTeam(type: ProjectType, projectId: number) {
  await connection();
  const p = PROJECTS[type];
  const [members, roles] = await Promise.all([
    db
      .prepare(`SELECT m.* FROM team_member m JOIN ${p.members} l ON l.memberId = m.id WHERE l.${p.owner} = ? ORDER BY m.position, m.id`)
      .all<Row>(projectId),
    db.prepare(`SELECT memberId, role FROM ${p.roles} WHERE ${p.owner} = ?`).all<{ memberId: number; role: string }>(projectId),
  ]);
  const byMember = rolesByMember(roles);
  return members.map((row) => {
    const member = parse(row);
    return { ...member, roles: sortRoles(byMember.get(member.id) ?? []) };
  });
}

export const listPatchTeam = (patchId: number) => listProjectTeam("patch", patchId);
export const listNovelTeam = (novelId: number) => listProjectTeam("novel", novelId);

export type MemberProjectRoles = {
  key: string;
  type: ProjectType;
  projectId: number;
  title: string;
  href: string; // fiche publique
  editHref: string; // section Équipe de la gestion du projet
  draft: boolean;
  roles: RoleKey[];
};

// Page Équipe et gestion d’un membre : pour chaque membre, ses projets (patchs puis novels, ordre alphabétique)
// et ses rôles sur chacun. `drafts` : inclure les novels en brouillon (gestion seulement).
export async function listTeamProjectRoles({ drafts = false }: { drafts?: boolean } = {}) {
  await connection();
  const [patchLinks, novelLinks, patchRoles, novelRoles] = await Promise.all([
    db
      .prepare(
        `SELECT l.memberId, p.id AS projectId, p.slug, p.title, p.kind, p.draft FROM patch_member l JOIN patch p ON p.id = l.patchId
         ${drafts ? "" : "WHERE p.draft = 0"} ORDER BY p.title COLLATE NOCASE`,
      )
      .all<{ memberId: number; projectId: number; slug: string; title: string; kind: string; draft: number }>(),
    db
      .prepare(
        `SELECT l.memberId, n.id AS projectId, n.slug, n.title, '' AS kind, n.draft FROM novel_member l JOIN novel n ON n.id = l.novelId
         ${drafts ? "" : "WHERE n.draft = 0"} ORDER BY n.title COLLATE NOCASE`,
      )
      .all<{ memberId: number; projectId: number; slug: string; title: string; kind: string; draft: number }>(),
    db.prepare("SELECT patchId AS projectId, memberId, role FROM patch_member_role").all<{ projectId: number; memberId: number; role: string }>(),
    db.prepare("SELECT novelId AS projectId, memberId, role FROM novel_member_role").all<{ projectId: number; memberId: number; role: string }>(),
  ]);
  const result = new Map<number, MemberProjectRoles[]>();
  const add = (type: ProjectType, links: typeof patchLinks, roles: typeof patchRoles) => {
    for (const link of links) {
      const projectId = Number(link.projectId);
      const memberId = Number(link.memberId);
      const keys = roles
        .filter((r) => Number(r.projectId) === projectId && Number(r.memberId) === memberId)
        .map((r) => r.role)
        .filter(isRoleKey);
      const list = result.get(memberId) ?? [];
      list.push({
        key: `${type}-${projectId}`,
        type,
        projectId,
        title: String(link.title),
        href: type === "patch" ? patchHref({ kind: String(link.kind), slug: String(link.slug) }) : `/novels/${link.slug}`,
        editHref: `${PROJECTS[type].edit}/${projectId}#${PROJECTS[type].anchor}`,
        draft: Number(link.draft) === 1,
        roles: sortRoles(keys),
      });
      result.set(memberId, list);
    }
  };
  add("patch", patchLinks, patchRoles);
  add("novel", novelLinks, novelRoles);
  return result;
}

export type TeamEntry = { memberId: number; roles: RoleKey[] };

// Nettoie une équipe envoyée par le navigateur : membres existants, sans doublon, rôles autorisés seulement.
async function cleanTeam(entries: TeamEntry[], allowed: readonly RoleKey[]) {
  const known = new Set((await db.prepare("SELECT id FROM team_member").all<{ id: number }>()).map((row) => Number(row.id)));
  const seen = new Set<number>();
  return entries
    .filter((entry) => known.has(entry.memberId) && !seen.has(entry.memberId) && seen.add(entry.memberId))
    .map((entry) => ({ memberId: entry.memberId, roles: sortRoles(entry.roles.filter((role) => isRoleKey(role) && allowed.includes(role))) }));
}

// Changements pour le journal : un par membre ajouté, retiré, ou dont les rôles changent.
async function teamChanges(type: ProjectType, projectId: number, after: TeamEntry[]): Promise<Change[]> {
  const p = PROJECTS[type];
  const names = new Map(
    (await db.prepare("SELECT id, name FROM team_member").all<{ id: number; name: string }>()).map((m) => [Number(m.id), String(m.name)]),
  );
  const rows = await db
    .prepare(
      `SELECT l.memberId, r.role FROM ${p.members} l LEFT JOIN ${p.roles} r ON r.${p.owner} = l.${p.owner} AND r.memberId = l.memberId
       WHERE l.${p.owner} = ?`,
    )
    .all<{ memberId: number; role: string | null }>(projectId);
  const before = new Map<number, RoleKey[]>();
  for (const row of rows) {
    const list = before.get(Number(row.memberId)) ?? [];
    if (row.role && isRoleKey(row.role)) list.push(row.role);
    before.set(Number(row.memberId), list);
  }
  const now = new Map(after.map((entry) => [entry.memberId, entry.roles]));
  const describe = (roles: RoleKey[] | undefined) =>
    roles === undefined ? "(absent)" : sortRoles(roles).map((role) => ROLE_LABELS[role]).join(", ") || "(aucun rôle)";
  return [...new Set([...before.keys(), ...now.keys()])].flatMap((memberId) => {
    const [b, a] = [describe(before.get(memberId)), describe(now.get(memberId))];
    return b === a ? [] : [{ field: `Équipe : ${names.get(memberId) ?? `membre ${memberId}`}`, before: b, after: a }];
  });
}

// Remplace l’équipe d’un projet (membres et rôles) en une seule transaction, avec son entrée au journal.
// `extra(changes)` : instructions ajoutées à la même transaction (date de mise à jour, journal d’activité).
export async function setProjectTeam(
  type: ProjectType,
  projectId: number,
  entries: TeamEntry[],
  allowed: readonly RoleKey[],
  extra: (changes: Change[]) => InStatement[],
) {
  const p = PROJECTS[type];
  const clean = await cleanTeam(entries, allowed);
  const changes = await teamChanges(type, projectId, clean);
  const ids = clean.map((entry) => entry.memberId);
  await db.batch([
    { sql: `DELETE FROM ${p.roles} WHERE ${p.owner} = ?`, args: [projectId] },
    {
      sql: `DELETE FROM ${p.members} WHERE ${p.owner} = ? AND memberId NOT IN (${ids.map(() => "?").join(", ")})`,
      args: [projectId, ...ids],
    },
    ...clean.flatMap((entry) => [
      { sql: `INSERT OR IGNORE INTO ${p.members} (${p.owner}, memberId) VALUES (?, ?)`, args: [projectId, entry.memberId] },
      ...entry.roles.map((role) => ({
        sql: `INSERT INTO ${p.roles} (${p.owner}, memberId, role) VALUES (?, ?, ?)`,
        args: [projectId, entry.memberId, role],
      })),
    ]),
    ...extra(changes),
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
