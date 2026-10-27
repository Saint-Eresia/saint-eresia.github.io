import "server-only";
import { createHash } from "node:crypto";
import type { InStatement } from "@libsql/client";
import { db } from "@/lib/db";

// Compteurs publics : visiteurs uniques (total et du jour, pied de page) et téléchargements des patchs.
// Tables et principe dans src/lib/db.ts (site_visitor, site_visit, patch_download, site_stat).

// Jour en cours à l’heure de Paris (AAAA-MM-JJ) : « aujourd’hui » commence à minuit pour les lecteurs.
export const parisDay = (date = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris" }).format(date);

// Robots (moteurs de recherche, aperçus de liens, outils) : jamais comptés.
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|curl|wget|python|node-fetch/i;
export const isBot = (userAgent: string | null) => BOT.test(userAgent ?? "");

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isVisitorId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

const bump = (key: string): InStatement => ({
  sql: "INSERT INTO site_stat (key, value) VALUES (?, 1) ON CONFLICT (key) DO UPDATE SET value = value + 1",
  args: [key],
});

export async function visitorStats() {
  const rows = await db
    .prepare("SELECT key, value FROM site_stat WHERE key IN ('visiteurs', ?)")
    .all<{ key: string; value: number }>(`visiteurs:${parisDay()}`);
  const value = (key: string) => Number(rows.find((row) => row.key === key)?.value ?? 0);
  return { total: value("visiteurs"), today: value(`visiteurs:${parisDay()}`) };
}

// Visite d’un navigateur (identifiant aléatoire qu’il garde) : comptée une fois au total et une fois par jour.
export async function recordVisit(visitorId: string) {
  const day = parisDay();
  const [, visitor, visit] = await db.batch([
    // Seul le jour en cours sert à éviter les doublons.
    { sql: "DELETE FROM site_visit WHERE day < ?", args: [day] },
    { sql: "INSERT OR IGNORE INTO site_visitor (id) VALUES (?)", args: [visitorId] },
    { sql: "INSERT OR IGNORE INTO site_visit (day, visitorId) VALUES (?, ?)", args: [day, visitorId] },
  ]);
  const updates = [...(visitor.changes ? [bump("visiteurs")] : []), ...(visit.changes ? [bump(`visiteurs:${day}`)] : [])];
  if (updates.length) await db.batch(updates);
}

// Empreinte d’un téléchargeur : hachage de l’IP et du navigateur, salé et changé chaque jour (rien n’est réversible).
function fingerprint(request: Request, day: string) {
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || request.headers.get("x-real-ip") || "";
  const agent = request.headers.get("user-agent") ?? "";
  return createHash("sha256")
    .update(`${process.env.BETTER_AUTH_SECRET ?? ""}|${day}|${ip}|${agent}`)
    .digest("base64url")
    .slice(0, 22);
}

// Téléchargement d’un patch : compté une fois par jour et par téléchargeur.
export async function recordDownload(patchId: number, request: Request) {
  const day = parisDay();
  const [, download] = await db.batch([
    { sql: "DELETE FROM patch_download WHERE day < ?", args: [day] },
    { sql: "INSERT OR IGNORE INTO patch_download (day, patchId, visitor) VALUES (?, ?, ?)", args: [day, patchId, fingerprint(request, day)] },
  ]);
  if (download.changes) await db.prepare("UPDATE patch SET downloads = downloads + 1 WHERE id = ?").run(patchId);
}
