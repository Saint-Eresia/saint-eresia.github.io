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
  return (db.prepare("SELECT * FROM team_member ORDER BY position, id").all() as Row[]).map(parse);
}

export async function getMember(id: number) {
  await connection();
  const row = db.prepare("SELECT * FROM team_member WHERE id = ?").get(id) as Row | undefined;
  return row ? parse(row) : null;
}
