import { createClient, type Client, type InStatement, type InValue, type Row } from "@libsql/client";
import fs from "node:fs";
import path from "node:path";
import { normalizeRole, normalizeRoles } from "@/lib/roles";

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
    -- Carrousel « Recommandé » de l’accueil : citation affichée et patch mis en avant (1) ou non (0).
    quote TEXT NOT NULL DEFAULT '',
    featured INTEGER NOT NULL DEFAULT 0,
    -- Type : 'vn' (rubrique Patchs VN) ou 'jeu' (rubrique Jeux, jeux vidéo hors visual novels).
    kind TEXT NOT NULL DEFAULT 'vn' CHECK (kind IN ('vn', 'jeu')),
    -- Brouillon (1) : invisible du public (listes, fiche, accueil, page Équipe, launcher), visible par l’équipe.
    draft INTEGER NOT NULL DEFAULT 0,
    -- Identifiants du jeu sur Steam et GOG : le launcher s’en sert pour retrouver le jeu installé.
    steamAppId INTEGER,
    gogId INTEGER,
    -- Identifiant VNDB (« v12345 ») ; vide si inconnu.
    vndbId TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS patch_image (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patchId INTEGER NOT NULL REFERENCES patch(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('cover', 'screenshot', 'background', 'logo')),
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
    -- Carrousel « Recommandé » de l’accueil : citation affichée et novel mis en avant (1) ou non (0).
    quote TEXT NOT NULL DEFAULT '',
    -- Commentaire de la citation, affiché au survol sur la fiche (ex. sa provenance).
    quoteNote TEXT NOT NULL DEFAULT '',
    -- Badge du format à côté de la couverture (ex. « WN », « LN ») et période de sortie (ex. « Depuis 2012 »).
    format TEXT NOT NULL DEFAULT '',
    released TEXT NOT NULL DEFAULT '',
    featured INTEGER NOT NULL DEFAULT 0,
    -- Brouillon (1) : invisible du public (listes, fiche, chapitres, accueil, page Équipe), visible par l’équipe.
    draft INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  -- Couverture du roman, arrière-plan, logo et illustrations insérées dans les chapitres.
  CREATE TABLE IF NOT EXISTS novel_image (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    novelId INTEGER NOT NULL REFERENCES novel(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('cover', 'illustration', 'background', 'logo')),
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
    -- Intitulé affiché à la place de « Tome N » (ex. « Arc VI ») ; vide : « Tome N ».
    label TEXT NOT NULL DEFAULT '',
    -- Précision affichée sous l’en-tête du tome dans le sommaire (Markdown), ex. crédits d’une traduction reprise.
    note TEXT NOT NULL DEFAULT '',
    -- Image en tête du tome dans le sommaire (URL ou fichier envoyé) et son crédit (Markdown), ex. « Illustration : X ».
    image TEXT NOT NULL DEFAULT '',
    imageCredit TEXT NOT NULL DEFAULT '',
    -- 1 : tome traduit par une autre équipe et seulement ré-édité (harmonisé) par Saint Eresia : mention « Re:edit ».
    reedit INTEGER NOT NULL DEFAULT 0,
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
    -- Crédits détaillés, affichés sous le titre du chapitre seulement (pas dans le sommaire) ; liens Markdown permis.
    credits TEXT NOT NULL DEFAULT '',
    downloadUrl TEXT NOT NULL DEFAULT '',
    -- Partie du tome (ex. « Phase 3 ») : les chapitres consécutifs de même phase sont regroupés dans le sommaire.
    phase TEXT NOT NULL DEFAULT '',
    -- Date de la première publication (flux RSS) ; vide pour un brouillon jamais publié.
    publishedAt TEXT,
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

  -- Membres de l’équipe ayant participé à un patch ou à un novel (affichés sur la fiche).
  -- role : rôle du membre sur ce VN ; vide, la fiche affiche son premier rôle de la page Équipe.
  CREATE TABLE IF NOT EXISTS patch_member (
    patchId INTEGER NOT NULL REFERENCES patch(id) ON DELETE CASCADE,
    memberId INTEGER NOT NULL REFERENCES team_member(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (patchId, memberId)
  );
  -- Actualités de la page d’accueil. content : Markdown. publishedAt : date de la première publication.
  CREATE TABLE IF NOT EXISTS news (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '',
    published INTEGER NOT NULL DEFAULT 0,
    publishedAt TEXT,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS news_published ON news (published, publishedAt);

  CREATE TABLE IF NOT EXISTS novel_member (
    novelId INTEGER NOT NULL REFERENCES novel(id) ON DELETE CASCADE,
    memberId INTEGER NOT NULL REFERENCES team_member(id) ON DELETE CASCADE,
    PRIMARY KEY (novelId, memberId)
  );

  -- Rôles d’un membre sur un patch, choisis dans la liste fixe de src/lib/roles.ts (une ligne par rôle).
  CREATE TABLE IF NOT EXISTS patch_member_role (
    patchId INTEGER NOT NULL REFERENCES patch(id) ON DELETE CASCADE,
    memberId INTEGER NOT NULL REFERENCES team_member(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    PRIMARY KEY (patchId, memberId, role)
  );

  -- Rôles d’un membre sur un novel (sous-ensemble NOVEL_ROLE_KEYS de src/lib/roles.ts).
  CREATE TABLE IF NOT EXISTS novel_member_role (
    novelId INTEGER NOT NULL REFERENCES novel(id) ON DELETE CASCADE,
    memberId INTEGER NOT NULL REFERENCES team_member(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    PRIMARY KEY (novelId, memberId, role)
  );

  -- Journal d’activité de la gestion : une ligne par modification, écrite dans la même transaction que celle-ci.
  -- actorId : identifiant du compte (Better Auth) ; entityId : élément concerné (peut ne plus exister) ;
  -- changes : JSON [{ "field": "Avancement Traduction", "before": "90 %", "after": "100 %" }, …].
  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL DEFAULT (datetime('now')),
    actorId TEXT NOT NULL,
    actorName TEXT NOT NULL,
    entityType TEXT NOT NULL,
    entityId INTEGER,
    entityLabel TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    changes TEXT NOT NULL DEFAULT '[]'
  );
  CREATE INDEX IF NOT EXISTS activity_log_at ON activity_log (at DESC, id DESC);
  CREATE INDEX IF NOT EXISTS activity_log_actor ON activity_log (actorId, at DESC);
  CREATE INDEX IF NOT EXISTS activity_log_type ON activity_log (entityType, at DESC);
`;

// Slug d’un nom de membre (ancre stable de la page Équipe) : « len. » → len, « Meruem_FGC » → meruem-fgc.
function memberSlug(name: string, taken: Set<string>) {
  const base = words(name).join("-").slice(0, 60) || "membre";
  let slug = base;
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
  taken.add(slug);
  return slug;
}

// Rôles par membre et par patch : colonnes slug et title des membres, puis reprise des rôles libres
// (patch_member.role, ex. « Traduction & Edition d'Images ») vers la liste fixe. Les anciennes colonnes
// (team_member.roles / projects, patch_member.role) sont conservées telles quelles.
async function migrateMemberRoles(client: Client, hadRoleTable: boolean) {
  const columns = ((await client.execute("PRAGMA table_info(team_member)")).rows as unknown as { name: string }[]).map((c) => c.name);
  if (!columns.includes("slug")) await client.execute("ALTER TABLE team_member ADD COLUMN slug TEXT");
  if (!columns.includes("title")) await client.execute("ALTER TABLE team_member ADD COLUMN title TEXT NOT NULL DEFAULT ''");

  const members = (await client.execute("SELECT id, name, roles, slug, title FROM team_member ORDER BY id")).rows as unknown as {
    id: number;
    name: string;
    roles: string;
    slug: string | null;
    title: string;
  }[];
  const taken = new Set(members.flatMap((member) => (member.slug ? [String(member.slug)] : [])));
  const updates: { sql: string; args: (string | number)[] }[] = [];
  for (const member of members) {
    if (!member.slug) updates.push({ sql: "UPDATE team_member SET slug = ? WHERE id = ?", args: [memberSlug(String(member.name), taken), Number(member.id)] });
    // « Fondateur » (ou tout rôle global hors liste) devient le titre, si aucun titre n’est encore défini.
    if (!columns.includes("title")) {
      const title = String(member.roles).split("\n").map((r) => r.trim()).find((r) => r && normalizeRole(r) === null);
      if (title) updates.push({ sql: "UPDATE team_member SET title = ? WHERE id = ?", args: [title, Number(member.id)] });
    }
  }
  if (updates.length) await client.batch(updates, "write");
  await client.execute("CREATE UNIQUE INDEX IF NOT EXISTS team_member_slug ON team_member (slug)");
  if (updates.length) console.log(`✓ Membres : slugs et titres renseignés (${updates.length} mise(s) à jour)`);

  if (hadRoleTable) return;
  // Langue par défaut d’un « Traduction » sans précision : celle du rôle global du membre.
  const translation = new Map(
    members.map((member) => {
      const keys = String(member.roles).split("\n").map((r) => normalizeRole(r));
      return [Number(member.id), keys.includes("trad-ja") && !keys.includes("trad-en") ? ("trad-ja" as const) : ("trad-en" as const)];
    }),
  );
  const links = (await client.execute("SELECT patchId, memberId, role FROM patch_member")).rows as unknown as {
    patchId: number;
    memberId: number;
    role: string;
  }[];
  const inserts = links.flatMap((link) =>
    normalizeRoles(String(link.role), translation.get(Number(link.memberId))).map((role) => ({
      sql: "INSERT OR IGNORE INTO patch_member_role (patchId, memberId, role) VALUES (?, ?, ?)",
      args: [Number(link.patchId), Number(link.memberId), role],
    })),
  );
  if (inserts.length) await client.batch(inserts, "write");
  console.log(`✓ Rôles par patch : ${inserts.length} rôle(s) repris de ${links.length} participation(s)`);
}

// Mots d’un texte, sans accents ni ponctuation : « La Mélancolie d’Haruhi » → la, melancolie, d, haruhi.
const words = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

// À la création des tables de participation : on relie chaque membre aux patchs et novels dont le titre
// contient tous les mots d’un de ses projets (page Équipe). Ex. « Suzumiya Haruhi » → « La Mélancolie d’Haruhi Suzumiya ».
async function linkMembersFromProjects(client: Client) {
  const members = (await client.execute("SELECT id, projects FROM team_member")).rows as unknown as { id: number; projects: string }[];
  const statements: { sql: string; args: number[] }[] = [];
  for (const [table, link, owner] of [["patch", "patch_member", "patchId"], ["novel", "novel_member", "novelId"]] as const) {
    const items = (await client.execute(`SELECT id, title FROM ${table}`)).rows as unknown as { id: number; title: string }[];
    for (const item of items) {
      const title = new Set(words(item.title));
      for (const member of members) {
        const projects = String(member.projects).split("\n").map(words).filter((project) => project.length > 0);
        if (projects.some((project) => project.every((word) => title.has(word)))) {
          statements.push({ sql: `INSERT OR IGNORE INTO ${link} (${owner}, memberId) VALUES (?, ?)`, args: [Number(item.id), Number(member.id)] });
        }
      }
    }
  }
  if (statements.length) await client.batch(statements, "write");
  return statements.length;
}

// Types d’image acceptés par chaque table. Les bases plus anciennes refusent les types ajoutés depuis
// (arrière-plan, logo) à cause de la contrainte CHECK. SQLite ne sait pas modifier une contrainte :
// la table d’images est alors reconstruite, données comprises.
const IMAGE_TABLES = [
  { table: "patch_image", owner: "patchId", parent: "patch", kinds: ["cover", "screenshot", "background", "logo"], index: "patch_image_patch ON patch_image (patchId, kind, position)" },
  { table: "novel_image", owner: "novelId", parent: "novel", kinds: ["cover", "illustration", "background", "logo"], index: null },
] as const;

async function allowImageKinds(client: Client, spec: (typeof IMAGE_TABLES)[number]) {
  const rs = await client.execute({ sql: "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?", args: [spec.table] });
  const sql = String(rs.rows[0]?.sql ?? "");
  if (!sql || spec.kinds.every((kind) => sql.includes(`'${kind}'`))) return false;
  const columns = `id, ${spec.owner}, kind, file, alt, width, height, position`;
  await client.batch(
    [
      `CREATE TABLE ${spec.table}_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ${spec.owner} INTEGER NOT NULL REFERENCES ${spec.parent}(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK (kind IN (${spec.kinds.map((kind) => `'${kind}'`).join(", ")})),
        file TEXT NOT NULL UNIQUE,
        alt TEXT NOT NULL DEFAULT '',
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        position INTEGER NOT NULL DEFAULT 0
      )`,
      `INSERT INTO ${spec.table}_new (${columns}) SELECT ${columns} FROM ${spec.table}`,
      `DROP TABLE ${spec.table}`,
      `ALTER TABLE ${spec.table}_new RENAME TO ${spec.table}`,
      ...(spec.index ? [`CREATE INDEX IF NOT EXISTS ${spec.index}`] : []),
    ],
    "write",
  );
  return true;
}

// Crée les tables du contenu et applique les mises à jour de structure. Appelée à l’ouverture en local,
// et par `npm run db:migrate` / `db:cloud` pour la base Turso.
export async function prepareSchema(client: Client) {
  // En local, une seule connexion : les pragmas restent actifs. Turso active déjà les clés étrangères.
  if (!TURSO_URL) await client.executeMultiple("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  const tableExists = async (name: string) =>
    (await client.execute({ sql: "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", args: [name] })).rows.length > 0;
  const hadMembers = await tableExists("patch_member");
  const hadRoleTable = await tableExists("patch_member_role");
  await client.executeMultiple(SCHEMA);
  if (!hadMembers) {
    const links = await linkMembersFromProjects(client);
    if (links) console.log(`✓ Participants : ${links} lien(s) repris des projets de la page Équipe`);
  }
  // Colonne ajoutée après la création des premières bases.
  const columns = (await client.execute("PRAGMA table_info(patch)")).rows as unknown as { name: string }[];
  if (!columns.some((column) => column.name === "progressSteps")) {
    await client.execute("ALTER TABLE patch ADD COLUMN progressSteps TEXT NOT NULL DEFAULT '[]'");
  }
  const memberColumns = (await client.execute("PRAGMA table_info(patch_member)")).rows as unknown as { name: string }[];
  if (!memberColumns.some((column) => column.name === "role")) {
    await client.execute("ALTER TABLE patch_member ADD COLUMN role TEXT NOT NULL DEFAULT ''");
  }
  await migrateMemberRoles(client, hadRoleTable);
  // Mise en avant sur l’accueil (carrousel « Recommandé ») : citation et choix des novels affichés.
  const novelColumns = ((await client.execute("PRAGMA table_info(novel)")).rows as unknown as { name: string }[]).map((c) => c.name);
  if (!novelColumns.includes("quote")) await client.execute("ALTER TABLE novel ADD COLUMN quote TEXT NOT NULL DEFAULT ''");
  if (!novelColumns.includes("featured")) await client.execute("ALTER TABLE novel ADD COLUMN featured INTEGER NOT NULL DEFAULT 0");
  if (!novelColumns.includes("draft")) await client.execute("ALTER TABLE novel ADD COLUMN draft INTEGER NOT NULL DEFAULT 0");
  if (!novelColumns.includes("quoteNote")) await client.execute("ALTER TABLE novel ADD COLUMN quoteNote TEXT NOT NULL DEFAULT ''");
  if (!novelColumns.includes("format")) await client.execute("ALTER TABLE novel ADD COLUMN format TEXT NOT NULL DEFAULT ''");
  if (!novelColumns.includes("released")) await client.execute("ALTER TABLE novel ADD COLUMN released TEXT NOT NULL DEFAULT ''");
  const chapterColumns = ((await client.execute("PRAGMA table_info(chapter)")).rows as unknown as { name: string }[]).map((c) => c.name);
  if (!chapterColumns.includes("credits")) await client.execute("ALTER TABLE chapter ADD COLUMN credits TEXT NOT NULL DEFAULT ''");
  if (!chapterColumns.includes("phase")) await client.execute("ALTER TABLE chapter ADD COLUMN phase TEXT NOT NULL DEFAULT ''");
  if (!chapterColumns.includes("publishedAt")) {
    await client.execute("ALTER TABLE chapter ADD COLUMN publishedAt TEXT");
    await client.execute("UPDATE chapter SET publishedAt = createdAt WHERE published = 1");
  }
  const volumeColumns = ((await client.execute("PRAGMA table_info(volume)")).rows as unknown as { name: string }[]).map((c) => c.name);
  if (!volumeColumns.includes("label")) await client.execute("ALTER TABLE volume ADD COLUMN label TEXT NOT NULL DEFAULT ''");
  if (!volumeColumns.includes("note")) await client.execute("ALTER TABLE volume ADD COLUMN note TEXT NOT NULL DEFAULT ''");
  if (!volumeColumns.includes("image")) await client.execute("ALTER TABLE volume ADD COLUMN image TEXT NOT NULL DEFAULT ''");
  if (!volumeColumns.includes("imageCredit")) await client.execute("ALTER TABLE volume ADD COLUMN imageCredit TEXT NOT NULL DEFAULT ''");
  if (!volumeColumns.includes("reedit")) await client.execute("ALTER TABLE volume ADD COLUMN reedit INTEGER NOT NULL DEFAULT 0");
  const patchColumns = ((await client.execute("PRAGMA table_info(patch)")).rows as unknown as { name: string }[]).map((c) => c.name);
  if (!patchColumns.includes("quote")) await client.execute("ALTER TABLE patch ADD COLUMN quote TEXT NOT NULL DEFAULT ''");
  if (!patchColumns.includes("featured")) await client.execute("ALTER TABLE patch ADD COLUMN featured INTEGER NOT NULL DEFAULT 0");
  if (!patchColumns.includes("draft")) await client.execute("ALTER TABLE patch ADD COLUMN draft INTEGER NOT NULL DEFAULT 0");
  if (!patchColumns.includes("steamAppId")) await client.execute("ALTER TABLE patch ADD COLUMN steamAppId INTEGER");
  if (!patchColumns.includes("gogId")) await client.execute("ALTER TABLE patch ADD COLUMN gogId INTEGER");
  if (!patchColumns.includes("vndbId")) await client.execute("ALTER TABLE patch ADD COLUMN vndbId TEXT NOT NULL DEFAULT ''");
  if (!patchColumns.includes("kind")) {
    await client.execute("ALTER TABLE patch ADD COLUMN kind TEXT NOT NULL DEFAULT 'vn' CHECK (kind IN ('vn', 'jeu'))");
  }
  for (const spec of IMAGE_TABLES) {
    if (await allowImageKinds(client, spec)) console.log(`✓ ${spec.table} : types d’image mis à jour (${spec.kinds.join(", ")})`);
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
      // Sur Turso, les tables sont créées par `npm run db:cloud` / `db:migrate` : rien à préparer à la requête.
      // En local, la préparation s’exécute une fois ; si elle échoue (ex. requête annulée par Next pendant
      // un pré-rendu), on l’oublie pour réessayer à la requête suivante au lieu de garder l’échec en cache.
      const current: Shared = { client, ready: Promise.resolve() };
      if (!TURSO_URL) {
        current.ready = prepareSchema(client).catch((error) => {
          if (shared === current) shared = undefined;
          if (globalForDb.libsql === current) globalForDb.libsql = undefined;
          throw error;
        });
      }
      shared = current;
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
  // Plusieurs écritures dans une seule transaction (tout ou rien). Renvoie, pour chaque instruction,
  // le nombre de lignes touchées et l’identifiant créé.
  async batch(statements: InStatement[]): Promise<RunResult[]> {
    const { client, ready } = getShared();
    await ready;
    const results = await client.batch(statements, "write");
    return results.map((rs) => ({ changes: rs.rowsAffected, lastInsertRowid: Number(rs.lastInsertRowid ?? 0) }));
  },
  // Attend la création des tables (utile dans les scripts).
  ready: () => getShared().ready,
};
