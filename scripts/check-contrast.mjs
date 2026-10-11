// Vérifie le contraste (WCAG 2.1 AA) des couples de couleurs du site, pour le thème clair (:root) et sombre (.dark).
// Les palettes sont lues dans src/app/globals.css. Usage : node scripts/check-contrast.mjs
import fs from "node:fs";

const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

function block(selector) {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/--([a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

// « hsl(h s% l% / a) » → [r, g, b, a] (0-1)
function parse(value) {
  const m = /hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%(?:\s*\/\s*([\d.]+))?\s*\)/.exec(value);
  if (!m) throw new Error(`Couleur illisible : ${value}`);
  const [h, s, l] = [Number(m[1]) / 360, Number(m[2]) / 100, Number(m[3]) / 100];
  const a = m[4] === undefined ? 1 : Number(m[4]);
  const hue = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue(p, q, h + 1 / 3), hue(p, q, h), hue(p, q, h - 1 / 3), a];
}

// Couleur (éventuellement transparente) posée sur un fond opaque.
const over = ([r, g, b, a], [R, G, B]) => [r * a + R * (1 - a), g * a + G * (1 - a), b * a + B * (1 - a), 1];
// « success/15 » de Tailwind : la couleur à 15 % d’opacité.
const alpha = ([r, g, b], a) => [r, g, b, a];

const lum = ([r, g, b]) => {
  const c = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const root = block(":root");
const themes = { clair: root, sombre: { ...root, ...block(".dark") } };

// [texte, fond, seuil, description] ; « nom/NN » = couleur à NN % d’opacité sur le fond de page.
const PAIRS = [
  ["foreground", "background", 4.5, "Texte principal"],
  ["foreground", "card", 4.5, "Texte sur carte"],
  ["muted-foreground", "background", 4.5, "Texte secondaire"],
  ["muted-foreground", "card", 4.5, "Texte secondaire sur carte"],
  ["muted-foreground", "secondary", 4.5, "Texte secondaire sur bandeau"],
  ["muted-foreground", "muted", 4.5, "Badge neutre (Brouillon, Abandonné…)"],
  ["secondary-foreground", "secondary", 4.5, "Texte sur bandeau"],
  ["popover-foreground", "popover", 4.5, "Menus et notifications"],
  ["primary", "background", 4.5, "Liens"],
  ["primary", "card", 4.5, "Liens sur carte"],
  ["primary", "accent", 4.5, "Onglet actif du menu"],
  ["primary-foreground", "primary", 4.5, "Bouton principal"],
  ["primary-foreground", "primary-dark", 4.5, "Bouton principal survolé"],
  ["accent-foreground", "accent", 4.5, "Badge de statut (en cours…)"],
  ["success", "success/15", 4.5, "Badge Terminé / Publiée"],
  ["warning", "warning/15", 4.5, "Badge En pause"],
  ["destructive", "background", 4.5, "Messages d’erreur"],
  ["prose", "background", 4.5, "Texte Markdown"],
  ["prose-reader", "background", 4.5, "Liseuse des chapitres"],
  ["callout-foreground", "callout", 4.5, "Encadré d’avertissement"],
  ["on-overlay", "overlay", 4.5, "Visionneuse d’images"],
  ["on-discord", "discord", 4.5, "Bouton Discord"],
  ["on-discord", "discord-hover", 4.5, "Bouton Discord survolé"],
  ["input", "background", 3, "Contour des champs"],
  ["ring", "background", 3, "Anneau de focus"],
];

let failures = 0;
for (const [name, theme] of Object.entries(themes)) {
  console.log(`\nThème ${name}`);
  const page = parse(theme.background);
  const color = (token) => {
    const [base, pct] = token.split("/");
    const c = parse(theme[base]);
    return over(pct ? alpha(c, Number(pct) / 100) : c, page);
  };
  for (const [fg, bg, min, label] of PAIRS) {
    const background = color(bg);
    const r = ratio(over(parse(theme[fg.split("/")[0]]), background), background);
    const ok = r >= min;
    if (!ok) failures++;
    console.log(`${ok ? "  ok " : "  ÉCHEC"} ${r.toFixed(2).padStart(5)} (min ${min})  ${label} — ${fg} sur ${bg}`);
  }
}
console.log(failures ? `\n${failures} couple(s) sous le seuil.` : "\nTous les couples respectent le seuil AA.");
process.exit(failures ? 1 : 0);
