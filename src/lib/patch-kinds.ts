// Types de patch : visual novel (/patchs) ou autre jeu vidéo (/jeux). Même fiche et même gestion,
// seules la rubrique publique et les libellés changent.
export const PATCH_KINDS = {
  vn: { label: "Patch VN", plural: "Patchs VN", path: "/patchs", tab: "patchs" },
  jeu: { label: "Jeu", plural: "Jeux", path: "/jeux", tab: "jeux" },
} as const;
export type PatchKind = keyof typeof PATCH_KINDS;
export const isPatchKind = (value: unknown): value is PatchKind => value === "vn" || value === "jeu";

// Adresse publique d’un patch selon son type.
export const patchHref = (patch: { kind: string; slug: string }) =>
  `${PATCH_KINDS[isPatchKind(patch.kind) ? patch.kind : "vn"].path}/${patch.slug}`;
