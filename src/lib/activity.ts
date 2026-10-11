import "server-only";
import type { InStatement } from "@libsql/client";
import { connection } from "next/server";
import { db } from "@/lib/db";

// Journal d’activité de la gestion. Chaque action de /gestion construit son entrée avec `logEntry` et l’exécute
// dans le même `db.batch` que la modification : les deux sont enregistrées ensemble, ou pas du tout.

export const ENTITY_TYPES = {
  patch: "Patch",
  novel: "Novel",
  volume: "Tome",
  chapter: "Chapitre",
  member: "Membre",
  news: "Actualité",
} as const;
export type EntityType = keyof typeof ENTITY_TYPES;
export const isEntityType = (value: string): value is EntityType => value in ENTITY_TYPES;

export type ActivityAction = "create" | "update" | "delete";
export type Change = { field: string; before: string; after: string };
export type Actor = { id: string; name: string };

// Champs comparés pour une modification : seuls ceux qui ont changé sont gardés.
// `long` : texte long (description, chapitre…) dont on note seulement qu’il a changé, avec sa longueur.
export function diff(fields: { label: string; before: unknown; after: unknown; long?: boolean }[]): Change[] {
  const text = (value: unknown) => (value === null || value === undefined ? "" : String(value));
  return fields.flatMap(({ label, before, after, long }) => {
    const [b, a] = [text(before), text(after)];
    if (b === a) return [];
    if (long) return [{ field: label, before: `${b.length} caractères`, after: `${a.length} caractères` }];
    return [{ field: label, before: b || "(vide)", after: a || "(vide)" }];
  });
}

// Instruction d’écriture du journal. `entityId: "last"` : l’identifiant que vient de créer l’instruction
// précédente du même lot (création d’un élément).
// Une modification où aucun champ n’a changé n’est pas journalisée : l’instruction ne fait alors rien,
// ce qui garde la même place dans le lot pour les résultats lus par l’appelant.
export function logEntry(
  actor: Actor,
  entry: { type: EntityType; id: number | "last" | null; label: string; action: ActivityAction; changes?: Change[] },
): InStatement {
  if (entry.action === "update" && !entry.changes?.length) return { sql: "SELECT 1", args: [] };
  const idSql = entry.id === "last" ? "last_insert_rowid()" : "?";
  return {
    sql: `INSERT INTO activity_log (actorId, actorName, entityType, entityId, entityLabel, action, changes)
          VALUES (?, ?, ?, ${idSql}, ?, ?, ?)`,
    args: [
      actor.id,
      actor.name,
      entry.type,
      ...(entry.id === "last" ? [] : [entry.id]),
      entry.label.slice(0, 200),
      entry.action,
      JSON.stringify(entry.changes ?? []),
    ],
  };
}

export type ActivityRow = {
  id: number;
  at: string;
  actorId: string;
  actorName: string;
  entityType: EntityType;
  entityId: number | null;
  entityLabel: string;
  action: ActivityAction;
  changes: Change[];
};

export const ACTIVITY_PAGE_SIZE = 25;

// Feed de /gestion, du plus récent au plus ancien, filtrable par membre (compte) et par type d’élément.
export async function listActivity({ actorId, type, page }: { actorId?: string; type?: EntityType; page: number }) {
  await connection();
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (actorId) {
    where.push("actorId = ?");
    args.push(actorId);
  }
  if (type) {
    where.push("entityType = ?");
    args.push(type);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [{ total }] = [(await db.prepare(`SELECT COUNT(*) AS total FROM activity_log ${clause}`).get<{ total: number }>(...args))!];
  const pages = Math.max(1, Math.ceil(Number(total) / ACTIVITY_PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pages);
  const rows = await db
    .prepare(`SELECT * FROM activity_log ${clause} ORDER BY at DESC, id DESC LIMIT ? OFFSET ?`)
    .all<Omit<ActivityRow, "changes"> & { changes: string }>(...args, ACTIVITY_PAGE_SIZE, (current - 1) * ACTIVITY_PAGE_SIZE);
  const entries: ActivityRow[] = rows.map((row) => {
    let changes: Change[] = [];
    try {
      changes = JSON.parse(String(row.changes));
    } catch {}
    return { ...row, id: Number(row.id), entityId: row.entityId === null ? null : Number(row.entityId), changes };
  });
  return { entries, total: Number(total), page: current, pages };
}

// Auteurs présents dans le journal (filtre « membre »), avec leur dernier nom connu.
export async function listActivityActors() {
  await connection();
  return db
    .prepare(
      `SELECT actorId, actorName FROM activity_log a
       WHERE id = (SELECT MAX(id) FROM activity_log b WHERE b.actorId = a.actorId)
       ORDER BY actorName COLLATE NOCASE`,
    )
    .all<{ actorId: string; actorName: string }>();
}
