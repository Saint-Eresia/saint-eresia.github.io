import "server-only";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type Viewer = { id: string; name: string; image: string | null; isTeam: boolean };

const list = (value = "") => value.split(",").map((entry) => entry.trim()).filter(Boolean);
const TEAM_ROLES = list(process.env.DISCORD_TEAM_ROLES);
// Comptes Discord qui ont toujours accès à la gestion, même sans rôle sur le serveur.
const ADMIN_IDS = list(process.env.DISCORD_ADMIN_IDS);
const CACHE_MS = 5 * 60_000;

// Résultat de la vérification des rôles, gardé quelques minutes pour ménager l’API Discord.
const globalForTeam = globalThis as unknown as { teamCache?: Map<string, { ok: boolean; until: number }> };
const teamCache = (globalForTeam.teamCache ??= new Map());

async function fetchIsTeam(userId: string): Promise<boolean> {
  // accountId est l’identifiant Discord de l’utilisateur.
  const account = await db
    .prepare("SELECT id, accountId FROM account WHERE userId = ? AND providerId = 'discord'")
    .get(userId) as { id: string; accountId: string } | undefined;
  if (!account) return false;
  if (ADMIN_IDS.includes(account.accountId)) return true;
  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId || TEAM_ROLES.length === 0) return false;
  // getAccessToken renouvelle le jeton s’il a expiré.
  const { accessToken } = await auth.api.getAccessToken({ body: { accountId: account.id, userId } });
  const res = await fetch(`https://discord.com/api/v10/users/@me/guilds/${guildId}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) return false; // 404 : pas membre du serveur
  const member = (await res.json()) as { roles: string[] };
  return member.roles.some((role) => TEAM_ROLES.includes(role));
}

async function isTeamMember(userId: string) {
  const hit = teamCache.get(userId);
  if (hit && hit.until > Date.now()) return hit.ok;
  let ok = false;
  try {
    ok = await fetchIsTeam(userId);
  } catch (error) {
    console.error("Vérification des rôles Discord impossible :", error);
  }
  teamCache.set(userId, { ok, until: Date.now() + CACHE_MS });
  return ok;
}

export async function getViewer(): Promise<Viewer | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, image } = session.user;
  return { id, name, image: image ?? null, isTeam: await isTeamMember(id) };
}

// À appeler en tête de chaque action qui modifie le contenu.
export async function requireTeam() {
  const viewer = await getViewer();
  if (!viewer?.isTeam) throw new Error("Action réservée aux membres de l’équipe.");
  return viewer;
}
