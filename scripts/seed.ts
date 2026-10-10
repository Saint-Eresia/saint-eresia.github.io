// Importe le contenu de l’ancien site (saint-eresia.github.io) : patchs, light novels, équipe et leurs images.
// Sans effet sur un patch ou un roman déjà présent (même slug). Lancer avec `npm run db:seed`.
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";
import { saveImage } from "../src/lib/uploads";
import { seedNovels } from "./seed-novels";
import { seedTeam } from "./seed-team";

type Seed = {
  slug: string;
  title: string;
  status: string;
  progress: number;
  downloadUrl: string;
  updatedAt: string;
  description: string;
  screenshots: string[];
  steps: { label: string; value: number }[];
};

const patches: Seed[] = [
  {
    slug: "chaos-child-fr",
    title: "CHAOS;CHILD — Patch FR",
    status: "Terminé",
    progress: 100,
    downloadUrl: "https://github.com/jabberwockyfool/Chaos-Child-FR/releases",
    updatedAt: "2026-08-15 12:00:00",
    screenshots: ["1.JPG", "1a.jpg", "2a.jpg", "3.jpg", "4.jpg"],
    steps: [
      { label: "Traduction", value: 100 },
      { label: "Édition des CG", value: 100 },
      { label: "Technique", value: 100 },
      { label: "Correction", value: 100 },
    ],
    description: `Traduction française de **CHAOS;CHILD** (5pb. / MAGES.), réalisée à partir du patch anglais de Committee of Zero. Le patch ne contient aucun fichier du jeu original.

## Prérequis

- Posséder légalement le jeu sur Steam ou GOG
- Aucun autre patch requis : le correctif Committee of Zero est déjà inclus

## Installation

1. Télécharger et lancer l’installeur.
2. L’installeur détecte automatiquement le jeu (Steam ou GOG) ; sinon, indiquer le dossier contenant \`Game.exe\`.
3. Les fichiers d’origine sont sauvegardés avant remplacement : la désinstallation les restaure.
4. Si le patch anglais Committee of Zero est déjà installé, ses fichiers sont simplement remplacés.

> Ce téléchargement ne contient pas le jeu original.

## Contenu de la V1 (~300 Mo)

- Scripts, dialogues et texte système traduits
- Police accentuée et sous-titres des vidéos intégrés
- Menus et CG traduits

## Liens

- [Dépôt du projet](https://github.com/jabberwockyfool/Chaos-Child-FR)
- [GameBanana](https://gamebanana.com/mods/698264)
- [Fiche VNDB](https://vndb.org/r159228)
- [Acheter le jeu sur Steam](https://store.steampowered.com/app/970570/)`,
  },
  {
    slug: "rance-01-fr",
    title: "Rance 01 : La quête pour Hikari — Patch FR",
    status: "Terminé",
    progress: 100,
    downloadUrl: "",
    updatedAt: "2026-08-15 11:00:00",
    screenshots: [],
    // Pas d’image à retoucher pour ce patch : pas de catégorie « Édition des CG ».
    steps: [
      { label: "Traduction", value: 100 },
      { label: "Technique", value: 100 },
      { label: "Correction", value: 100 },
    ],
    description: `Traduction française du remake de **Rance 01** (ランス01 光をもとめて), développé par AliceSoft.

## Prérequis

- Posséder légalement le jeu original (édition Windows)

## Installation

Les étapes d’installation seront publiées avec la première version du patch.

> Ce téléchargement ne contient pas le jeu original.
>
> Œuvre réservée à un public adulte.

## Liens

- [Acheter le jeu sur Steam](https://store.steampowered.com/app/3867130/) (fiche « Rance 01 + 02 »)`,
  },
];

const IMAGES = path.join(import.meta.dirname, "seed-data", "patches");

async function main() {
  await seedPatches();
  await seedNovels();
  await seedTeam();
}

async function seedPatches() {
  for (const seed of patches) {
    if (await db.prepare("SELECT 1 FROM patch WHERE slug = ?").get(seed.slug)) {
      // Base créée avant l’avancement détaillé : on complète seulement s’il n’y a encore aucune catégorie.
      const { changes } = await db
        .prepare("UPDATE patch SET progressSteps = ? WHERE slug = ? AND progressSteps = '[]'")
        .run(JSON.stringify(seed.steps), seed.slug);
      console.log(`· ${seed.title} : déjà présent${changes ? ", avancement détaillé ajouté" : ", ignoré"}`);
      continue;
    }
    const { lastInsertRowid } = await db
      .prepare(
        "INSERT INTO patch (slug, title, description, status, progress, downloadUrl, progressSteps, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .run(seed.slug, seed.title, seed.description, seed.status, seed.progress, seed.downloadUrl, JSON.stringify(seed.steps), seed.updatedAt, seed.updatedAt);
    const owner = { type: "patch" as const, id: Number(lastInsertRowid) };
    const dir = path.join(IMAGES, seed.slug);
    await saveImage(owner, "cover", await fs.readFile(path.join(dir, "cover.webp")), `Couverture de ${seed.title}`);
    for (const [index, name] of seed.screenshots.entries()) {
      const alt = `Capture d’écran de ${seed.title} (${index + 1})`;
      await saveImage(owner, "screenshot", await fs.readFile(path.join(dir, name)), alt);
    }
    console.log(`✓ ${seed.title} : importé avec ${seed.screenshots.length} capture(s)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
