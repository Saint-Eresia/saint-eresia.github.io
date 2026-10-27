"use server";

import { headers } from "next/headers";
import { isBot, isVisitorId, recordVisit, visitorStats } from "@/lib/stats";

// Visiteurs uniques du pied de page (voir visitor-stats.tsx). `id` : identifiant du navigateur, à donner seulement
// pour sa première visite du jour (enregistrée) ; sans lui, les compteurs sont seulement lus.
// Une action plutôt qu’une route /api : appelée depuis le layout, une route relance en boucle le rechargement à chaud
// du serveur de développement.
export async function visitorCounts(id: string | null) {
  if (id !== null && isVisitorId(id) && !isBot((await headers()).get("user-agent"))) await recordVisit(id);
  return visitorStats();
}
