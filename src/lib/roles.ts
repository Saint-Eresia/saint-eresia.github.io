// Rôles d’un membre sur un patch : liste fixe (partagée client/serveur). La clé est stockée en base,
// le libellé n’est qu’affiché : il peut changer sans migration.
export const ROLES = [
  { key: "trad-ja", label: "Traduction (JA → FR)", short: "Trad. JA" },
  { key: "trad-en", label: "Traduction (EN → FR)", short: "Trad. EN" },
  { key: "correction", label: "Correction", short: "Correction" },
  { key: "harmonisation", label: "Harmonisation", short: "Harmonis." },
  { key: "images", label: "Édition d’images", short: "Images" },
  { key: "programmation", label: "Programmation", short: "Prog." },
  { key: "hacking", label: "Hacking", short: "Hacking" },
  { key: "beta", label: "Bêta-test", short: "Bêta" },
  { key: "communication", label: "Communication", short: "Comm." },
  { key: "site", label: "Site Internet", short: "Site" },
] as const;

export type RoleKey = (typeof ROLES)[number]["key"];
export const ROLE_KEYS = ROLES.map((role) => role.key) as RoleKey[];
export const ROLE_LABELS = Object.fromEntries(ROLES.map((role) => [role.key, role.label])) as Record<RoleKey, string>;
export const isRoleKey = (value: string): value is RoleKey => (ROLE_KEYS as string[]).includes(value);

// Rôles proposés sur un light novel : ceux qui ont un sens pour un texte (pas de programmation ni de hacking).
export const NOVEL_ROLE_KEYS: RoleKey[] = ["trad-ja", "trad-en", "correction", "harmonisation", "images", "communication"];
export const NOVEL_ROLES = ROLES.filter((role) => NOVEL_ROLE_KEYS.includes(role.key));

// Rôles triés dans l’ordre de la liste, pour un affichage stable.
export const sortRoles = (keys: RoleKey[]) => ROLE_KEYS.filter((key) => keys.includes(key));

const plain = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// Convertit un rôle écrit à la main (« Edition d'Images », « Traduction (EN->FR) », « Programattion »…)
// vers la liste fixe. `translation` : langue à retenir pour un « Traduction » sans précision.
// Renvoie null pour un texte sans équivalent (ex. « Fondateur », qui devient le titre du membre).
export function normalizeRole(text: string, translation: "trad-ja" | "trad-en" = "trad-en"): RoleKey | null {
  const t = plain(text);
  if (t.includes("traduc")) {
    if (/\bja\b|japon/.test(t)) return "trad-ja";
    if (/\ben\b|angl/.test(t)) return "trad-en";
    return translation;
  }
  if (t.includes("image")) return "images";
  if (t.includes("prog")) return "programmation";
  if (t.includes("hack")) return "hacking";
  if (t.includes("beta") || t.includes("test")) return "beta";
  if (t.includes("harmoni")) return "harmonisation";
  if (t.includes("correc") || t.includes("relect")) return "correction";
  if (t.includes("commun")) return "communication";
  if (t.includes("site") || t.includes("web")) return "site";
  return null;
}

// Plusieurs rôles dans un même texte : « Traduction & Edition d'Images », « Beta-Testing / Harmonisation ».
export function normalizeRoles(text: string, translation?: "trad-ja" | "trad-en") {
  const keys = text
    .split(/\s*(?:&|\+|,|\/|\bet\b)\s*/i)
    .map((part) => normalizeRole(part, translation))
    .filter((key): key is RoleKey => key !== null);
  return sortRoles([...new Set(keys)]);
}
