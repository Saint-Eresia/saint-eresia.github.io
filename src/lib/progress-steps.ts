// Avancement détaillé d’un patch, par catégorie de travail (partagé client/serveur).
export type ProgressStep = { label: string; value: number };

export const SUGGESTED_STEPS = ["Traduction", "Édition des CG", "Correction", "Technique", "Tests"];
export const MAX_STEPS = 12;

// Avancement global : la moyenne des catégories.
export const averageProgress = (steps: ProgressStep[]) =>
  steps.length ? Math.round(steps.reduce((total, step) => total + step.value, 0) / steps.length) : 0;

export function parseSteps(json: string): ProgressStep[] {
  try {
    const value = JSON.parse(json);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
