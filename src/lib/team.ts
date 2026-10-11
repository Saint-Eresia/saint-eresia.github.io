import "server-only";
import { connection } from "next/server";
import { db } from "@/lib/db";
import type { LinkKind } from "@/lib/team-links";

export { LINK_KINDS, LINK_LABELS, type LinkKind } from "@/lib/team-links";

type Row = { id: number; name: string; avatarFile: string; roles: string; projects: string; links: string; position: number };
export type TeamMember = Omit<Row, "roles" | "projects" | "links"> & {
  roles: string[];
  projects: string[];
  links: Partial<Record<LinkKind, string>>;
};

export const splitLines = (text: string) => text.split("\n").map((line) => line.trim()).filter(Boolean);

function parse(row: Row): TeamMember {
  let links: TeamMember["links"] = {};
  try {
    links = JSON.parse(row.links);
  } catch {}
  return { ...row, roles: splitLines(row.roles), projects: splitLines(row.projects), links };
}

export async function listTeam() {
  await connection();
  return (await db.prepare("SELECT * FROM team_member ORDER BY position, id").all() as Row[]).map(parse);
}

// Participants d’un patch ou d’un novel, dans l’ordre de la page Équipe.
export type ProjectType = "patch" | "novel";
// role : rôle propre au projet (seuls les patchs en ont un).
const PROJECT_LINKS = {
  patch: { table: "patch_member", column: "patchId", role: "l.role" },
  novel: { table: "novel_member", column: "novelId", role: "''" },
} as const;

export type ProjectMember = TeamMember & { projectRole: string };

export async function listProjectMembers(type: ProjectType, id: number): Promise<ProjectMember[]> {
  await connection();
  const { table, column, role } = PROJECT_LINKS[type];
  const rows = await db
    .prepare(
      `SELECT m.*, ${role} AS projectRole FROM team_member m JOIN ${table} l ON l.memberId = m.id WHERE l.${column} = ? ORDER BY m.position, m.id`,
    )
    .all<Row & { projectRole: string }>(id);
  return rows.map((row) => ({ ...parse(row), projectRole: String(row.projectRole) }));
}

export async function listProjectLinks(type: ProjectType, id: number) {
  await connection();
  const { table, column, role } = PROJECT_LINKS[type];
  const rows = await db
    .prepare(`SELECT l.memberId, ${role} AS role FROM ${table} l WHERE l.${column} = ?`)
    .all<{ memberId: number; role: string }>(id);
  return rows.map((row) => ({ memberId: Number(row.memberId), role: String(row.role) }));
}

// Remplace la liste des participants (identifiants inconnus ignorés), en une seule transaction.
// Les membres déjà présents restent en place, avec leur rôle sur le projet.
export async function setProjectMembers(type: ProjectType, id: number, memberIds: number[]) {
  const { table, column } = PROJECT_LINKS[type];
  const known = new Set(
    (await db.prepare("SELECT id FROM team_member").all<{ id: number }>()).map((row) => Number(row.id)),
  );
  const ids = [...new Set(memberIds)].filter((memberId) => known.has(memberId));
  await db.batch([
    {
      sql: `DELETE FROM ${table} WHERE ${column} = ? AND memberId NOT IN (${ids.map(() => "?").join(", ")})`,
      args: [id, ...ids],
    },
    ...ids.map((memberId) => ({ sql: `INSERT OR IGNORE INTO ${table} (${column}, memberId) VALUES (?, ?)`, args: [id, memberId] })),
  ]);
}

// Section « Rôles par VN » de la fiche d’un membre : les patchs auxquels il participe.
export async function listMemberPatchRoles(memberId: number) {
  await connection();
  const rows = await db
    .prepare("SELECT p.id, p.title, l.role FROM patch_member l JOIN patch p ON p.id = l.patchId WHERE l.memberId = ? ORDER BY p.title")
    .all<{ id: number; title: string; role: string }>(memberId);
  return rows.map((row) => ({ patchId: Number(row.id), title: String(row.title), role: String(row.role) }));
}

export async function getMember(id: number) {
  await connection();
  const row = await db.prepare("SELECT * FROM team_member WHERE id = ?").get(id) as Row | undefined;
  return row ? parse(row) : null;
}
