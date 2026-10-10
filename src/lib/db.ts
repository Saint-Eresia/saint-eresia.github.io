import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

function open() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "saint-eresia.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  // Tables du contenu. Celles de Better Auth sont créées par ses propres migrations.
  db.exec(`
    CREATE TABLE IF NOT EXISTS patch (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
      downloadUrl TEXT NOT NULL DEFAULT '',
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
  `);
  // Colonnes ajoutées après la création des premières bases.
  const patchColumns = db.prepare("PRAGMA table_info(patch)").all() as { name: string }[];
  if (!patchColumns.some((column) => column.name === "progressSteps")) {
    db.exec("ALTER TABLE patch ADD COLUMN progressSteps TEXT NOT NULL DEFAULT '[]'");
  }
  return db;
}

// Une seule connexion, conservée entre les rechargements à chaud du serveur de dev.
const globalForDb = globalThis as unknown as { db?: Database.Database };
export const db = globalForDb.db ?? open();
if (process.env.NODE_ENV !== "production") globalForDb.db = db;
