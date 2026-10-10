// Liens proposés pour chaque membre de l’équipe, dans l’ordre d’affichage (partagé client/serveur).
export const LINK_KINDS = ["site", "github", "gamebanana", "youtube", "linktree"] as const;
export type LinkKind = (typeof LINK_KINDS)[number];
export const LINK_LABELS: Record<LinkKind, string> = {
  site: "Site",
  github: "GitHub",
  gamebanana: "GameBanana",
  youtube: "YouTube",
  linktree: "Linktree",
};
