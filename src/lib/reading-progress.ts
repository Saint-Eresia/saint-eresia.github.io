// Dernière lecture d’un novel, mémorisée dans le navigateur du lecteur (localStorage, côté client seulement) :
// chapitre ouvert et bloc de texte (paragraphe, image…) atteint, pour « Reprendre la lecture ».
export type ReadingProgress = { slug: string; heading: string; block: number; at: number };

const key = (novelSlug: string) => `lecture:dernier:${novelSlug}`;

// Texte brut mémorisé : chaîne comparable telle quelle (instantané stable pour useSyncExternalStore).
export function rawProgress(novelSlug: string): string | null {
  try {
    return localStorage.getItem(key(novelSlug));
  } catch {
    return null;
  }
}

export function parseProgress(raw: string | null): ReadingProgress | null {
  try {
    const saved = JSON.parse(raw ?? "null") as Partial<ReadingProgress> | null;
    if (!saved || typeof saved.slug !== "string" || typeof saved.heading !== "string") return null;
    return { slug: saved.slug, heading: saved.heading, block: Number(saved.block) || 0, at: Number(saved.at) || 0 };
  } catch {
    return null;
  }
}

export const readProgress = (novelSlug: string) => parseProgress(rawProgress(novelSlug));

export function writeProgress(novelSlug: string, progress: ReadingProgress) {
  try {
    localStorage.setItem(key(novelSlug), JSON.stringify(progress));
  } catch {}
}

// Ancre ajoutée au lien « Reprendre » : le lecteur fait alors défiler jusqu’au bloc mémorisé.
export const RESUME_HASH = "#reprendre";
