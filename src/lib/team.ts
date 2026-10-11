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
const PROJECT_LINKS = {
  patch: { table: "patch_member", column: "patchId" },
  novel: { table: "novel_member", column: "novelId" },
} as const;

export async function listProjectMembers(type: ProjectType, id: number) {
  await connection();
  const { table, column } = PROJECT_LINKS[type];
  const rows = await db
    .prepare(`SELECT m.* FROM team_member m JOIN ${table} l ON l.memberId = m.id WHERE l.${column} = ? ORDER BY m.position, m.id`)
    .all<Row>(id);
  return rows.map(parse);
}

export async function listProjectMemberIds(type: ProjectType, id: number) {
  await connection();
  const { table, column } = PROJECT_LINKS[type];
  const rows = await db.prepare(`SELECT memberId FROM ${table} WHERE ${column} = ?`).all<{ memberId: number }>(id);
  return rows.map((row) => Number(row.memberId));
}

// Remplace la liste des participants (identifiants inconnus ignorés), en une seule transaction.
export async function setProjectMembers(type: ProjectType, id: number, memberIds: number[]) {
  const { table, column } = PROJECT_LINKS[type];
  const known = new Set(
    (await db.prepare("SELECT id FROM team_member").all<{ id: number }>()).map((row) => Number(row.id)),
  );
  const ids = [...new Set(memberIds)].filter((memberId) => known.has(memberId));
  await db.batch([
    { sql: `DELETE FROM ${table} WHERE ${column} = ?`, args: [id] },
    ...ids.map((memberId) => ({ sql: `INSERT INTO ${table} (${column}, memberId) VALUES (?, ?)`, args: [id, memberId] })),
  ]);
}

export async function getMember(id: number) {
  await connection();
  const row = await db.prepare("SELECT * FROM team_member WHERE id = ?").get(id) as Row | undefined;
  return row ? parse(row) : null;
}
