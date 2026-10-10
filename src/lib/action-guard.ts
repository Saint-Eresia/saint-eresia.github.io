import "server-only";
import { requireTeam } from "@/lib/viewer";

export type ActionResult = { error?: string; savedAt?: number };

// Chaque action vérifie les droits côté serveur, quel que soit l’affichage du client.
export async function guard(): Promise<ActionResult | null> {
  try {
    await requireTeam();
    return null;
  } catch (error) {
    return { error: (error as Error).message };
  }
}

export const isHttpUrl = (value: string) => /^https?:\/\/\S+$/i.test(value);
