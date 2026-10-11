import "server-only";
import type { Actor } from "@/lib/activity";
import { requireTeam } from "@/lib/viewer";

export type ActionResult = { error?: string; savedAt?: number };

// Chaque action vérifie les droits côté serveur, quel que soit l’affichage du client.
// Renvoie l’auteur de l’action (inscrit au journal d’activité), ou l’erreur à afficher :
//   const actor = await teamActor();
//   if ("error" in actor) return actor;
export async function teamActor(): Promise<Actor | { error: string }> {
  try {
    const viewer = await requireTeam();
    return { id: viewer.id, name: viewer.name };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export const isHttpUrl = (value: string) => /^https?:\/\/\S+$/i.test(value);
