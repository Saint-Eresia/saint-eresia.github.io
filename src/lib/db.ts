import { createClient, type Client, type InStatement, type InValue, type Row } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";

// En développement : base SQLite et images dans data/.
// En production (Vercel) : base distante Turso (compatible SQLite) et images sur Vercel Blob.
export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

const TURSO_URL = process.env.TURSO_DATABASE_URL;

function connect(): Client {
  if (TURSO_URL) return createClient({ url: TURSO_URL, authToken: process.env.TURSO_AUTH_TOKEN });
  if (process.env.VERCEL) {
    throw new Error("TURSO_DATABASE_URL manquant : sur Vercel, la base doit être distante (voir README, section Déploiement).");
  }
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const file = path.join(DATA_DIR, "saint-eresia.db").replace(/\\/g, "/");
  return createClient({ url: `file:${file}` });
}

// Tables du contenu. Celles de Better Auth sont créées par ses propres migrations (npm run db:migrate).
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS patch (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    downloadUrl TEXT NOT NULL DEFAULT '',
    progressSteps TEXT NOT NULL DEFAULT '[]',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS patch_image (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patchId INTEGER NOT NULL REFERENCES patch(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('cover', 'screenshot')),
    file TEXT NOT NULL UNIQUE,
    alt TEXT NOT NULL DEFAULT '',
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS patch_image_patch ON patch_image (patchId, kind, position);

  CREATE TABLE IF NOT EXISTS novel (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    originalTitle TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    artist TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    synopsis TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Couverture du roman et illustrations insérées dans les chapitres.
  CREATE TABLE IF NOT EXISTS novel_image (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    novelId INTEGER NOT NULL REFERENCES novel(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('cover', 'illustration')),
    file TEXT NOT NULL UNIQUE,
    alt TEXT NOT NULL DEFAULT '',
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    position INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS volume (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    novelId INTEGER NOT NULL REFERENCES novel(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    UNIQUE (novelId, number)
  );
  CREATE TABLE IF NOT EXISTS chapter (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    novelId INTEGER NOT NULL REFERENCES novel(id) ON DELETE CASCADE,
    volumeId INTEGER NOT NULL REFERENCES volume(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    label TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    published INTEGER NOT NULL DEFAULT 0,
    translators TEXT NOT NULL DEFAULT '',
    downloadUrl TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (novelId, slug)
  );
  CREATE INDEX IF NOT EXISTS chapter_volume ON chapter (volumeId, position);

  -- Membres affichés sur la page Équipe. roles et projects : une entrée par ligne ; links : JSON.
  CREATE TABLE IF NOT EXISTS team_member (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    avatarFile TEXT NOT NULL DEFAULT '',
    roles TEXT NOT NULL DEFAULT '',
    projects TEXT NOT NULL DEFAULT '',
    links TEXT NOT NULL DEFAULT '{}',
    position INTEGER NOT NULL DEFAULT 0
  );
`;

async function prepareSchema(client: Client) {
  // En local, une seule connexion : les pragmas restent actifs. Turso active déjà les clés étrangères.
  if (!TURSO_URL) await client.executeMultiple("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  await client.executeMultiple(SCHEMA);
  // Colonne ajoutée après la création des premières bases.
  const columns = (await client.execute("PRAGMA table_info(patch)")).rows as unknown as { name: string }[];
  if (!columns.some((column) => column.name === "progressSteps")) {
    await client.execute("ALTER TABLE patch ADD COLUMN progressSteps TEXT NOT NULL DEFAULT '[]'");
  }
}

// Une seule connexion, ouverte à la première requête (pas pendant le build) et conservée
// entre les rechargements à chaud du serveur de dev.
type Shared = { client: Client; ready: Promise<void> };
const globalForDb = globalThis as unknown as { libsql?: Shared };
let shared: Shared | undefined;
function getShared(): Shared {
  if (!shared) {
    shared = globalForDb.libsql;
    if (!shared) {
      const client = connect();
      shared = { client, ready: prepareSchema(client) };
      if (process.env.NODE_ENV !== "production") globalForDb.libsql = shared;
    }
  }
  return shared;
}

// Client libSQL brut (Better Auth, scripts). Chaque méthode ouvre la connexion au besoin.
export const client: Client = new Proxy({} as Client, {
  get(_target, property) {
    const real = getShared().client;
    const value = Reflect.get(real, property) as unknown;
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});

export type RunResult = { changes: number; lastInsertRowid: number };

// Lignes converties en objets simples (clé = nom de colonne).
const toObject = (row: Row, columns: string[]) => Object.fromEntries(columns.map((name, index) => [name, row[index]]));

async function execute(sql: string, args: InValue[]) {
  const { client, ready } = getShared();
  await ready;
  return client.execute({ sql, args });
}

// Même forme que better-sqlite3 (db.prepare(sql).get/all/run), mais asynchrone.
export const db = {
  prepare(sql: string) {
    return {
      async get<T = Record<string, unknown>>(...args: InValue[]): Promise<T | undefined> {
        const rs = await execute(sql, args);
        return rs.rows.length ? (toObject(rs.rows[0], rs.columns) as T) : undefined;
      },
      async all<T = Record<string, unknown>>(...args: InValue[]): Promise<T[]> {
        const rs = await execute(sql, args);
        return rs.rows.map((row) => toObject(row, rs.columns) as T);
      },
      async run(...args: InValue[]): Promise<RunResult> {
        const rs = await execute(sql, args);
        return { changes: rs.rowsAffected, lastInsertRowid: Number(rs.lastInsertRowid ?? 0) };
      },
    };
  },
  // Plusieurs écritures dans une seule transaction.
  async batch(statements: InStatement[]) {
    const { client, ready } = getShared();
    await ready;
    await client.batch(statements, "write");
  },
  // Attend la création des tables (utile dans les scripts).
  ready: () => getShared().ready,
};
