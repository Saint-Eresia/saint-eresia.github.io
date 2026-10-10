// Light novels de l’ancien site : fiche, tomes et chapitres (seed-data/novels/<slug>/), illustrations.
// Même convention de fichiers que l’ancien dossier content/ :
//   <slug>/tome-01.md                  → un tome lu d’un bloc
//   <slug>/volume-01/prologue.md       → Prologue, puis chapitre-01.md, interlude-01.md, epilogue.md
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../src/lib/db";
import { slugify } from "../src/lib/patches";
import { saveImage } from "../src/lib/uploads";

type NovelSeed = {
  slug: string;
  title: string;
  originalTitle: string;
  author: string;
  artist: string;
  status: string;
  cover: string;
  synopsis: string;
};

const novels: NovelSeed[] = [
  {
    slug: "rakudai-kishi-no-cavalry",
    title: "Rakudai Kishi no Cavalry",
    originalTitle: "落第騎士の英雄譚",
    author: "Riku Misora",
    artist: "Won",
    status: "En cours",
    cover: "rakudai.webp",
    synopsis: `Light novel de Riku Misora illustré par Won, publié chez SB Creative (GA Bunko). Récit d’action situé dans une académie de chevaliers-mages.

> **Par où commencer ?** L’anime couvre les tomes 1 à 3, soit l’intégralité de l’arc du Tournoi de Sélection. Si vous l’avez vu, vous pouvez commencer directement au tome 4, au début de l’arc du Festival des Sept Étoiles.`,
  },
  {
    slug: "zero-no-tsukaima",
    title: "Zero no Tsukaima",
    originalTitle: "ゼロの使い魔",
    author: "Noboru Yamaguchi",
    artist: "Eiji Usatsuka",
    status: "En cours",
    cover: "zeronotsukaima.webp",
    synopsis:
      "Light novel de Noboru Yamaguchi illustré par Eiji Usatsuka, publié chez Media Factory (MF Bunko J). Comédie fantastique autour d’une apprentie mage et de son familier.",
  },
  {
    slug: "la-melancolie-de-haruhi-suzumiya",
    title: "La Mélancolie d’Haruhi Suzumiya",
    originalTitle: "涼宮ハルヒの憂鬱",
    author: "Nagaru Tanigawa",
    artist: "Noizi Ito",
    status: "En cours",
    cover: "suzumiya.webp",
    synopsis: `Light novel de Nagaru Tanigawa illustré par Noizi Ito, publié chez Kadokawa (Sneaker Bunko). Premier tome de la série Haruhi Suzumiya.

> Les cinq premiers tomes ont été partiellement traduits par Baka-Tsuki. La suite est traduite par Saint Eresia.`,
  },
];

const DATA = path.join(import.meta.dirname, "seed-data");
const IMAGE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

// En-tête « clé: valeur » entre deux lignes ---, puis le corps (sans les commentaires HTML).
function splitFrontMatter(raw: string) {
  const text = raw.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta: Record<string, string> = {};
  for (const line of match ? match[1].split("\n") : []) {
    const at = line.indexOf(":");
    if (at > 0) meta[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
  }
  const body = (match ? text.slice(match[0].length) : text).replace(/<!--[\s\S]*?-->/g, "").trim();
  return { meta, body };
}

// Chemin du fichier → tome, libellé et ordre dans le tome.
function locate(relative: string) {
  const parts = relative.split(path.sep);
  const tome = parts.length === 1 ? parts[0].match(/^tome-(\d+)\.md$/i) : null;
  if (tome) return { volume: Number(tome[1]), label: `Tome ${Number(tome[1])}`, position: 10 };
  const folder = parts.length === 2 ? parts[0].match(/^volume-(\d+)$/i) : null;
  if (!folder) return null;
  const volume = Number(folder[1]);
  if (/^prologue\.md$/i.test(parts[1])) return { volume, label: "Prologue", position: 0 };
  if (/^epilogue\.md$/i.test(parts[1])) return { volume, label: "Épilogue", position: 100000 };
  const numbered = parts[1].match(/^(chapitre|interlude)-(\d+)\.md$/i);
  if (!numbered) return null;
  const n = Number(numbered[2]);
  return numbered[1].toLowerCase() === "chapitre"
    ? { volume, label: `Chapitre ${n}`, position: n * 10 }
    : { volume, label: `Interlude ${n}`, position: n * 10 + 5 };
}

// « 15/08/2026 » ou « 2026-08-15 » → date SQLite.
function toSqlDate(raw = "") {
  const fr = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) return `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")} 12:00:00`;
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw} 12:00:00` : null;
}

async function walk(dir: string, base = dir): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith("_")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full, base)));
    else if (/\.md$/i.test(entry.name)) files.push(path.relative(base, full));
  }
  return files;
}

async function seedNovel(seed: NovelSeed) {
  if (db.prepare("SELECT 1 FROM novel WHERE slug = ?").get(seed.slug)) {
    console.log(`· ${seed.title} : déjà présent, ignoré`);
    return;
  }
  const novelId = Number(
    db
      .prepare("INSERT INTO novel (slug, title, originalTitle, author, artist, status, synopsis) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(seed.slug, seed.title, seed.originalTitle, seed.author, seed.artist, seed.status, seed.synopsis).lastInsertRowid,
  );
  const owner = { type: "novel" as const, id: novelId };
  await saveImage(owner, "cover", await fs.readFile(path.join(DATA, "covers", seed.cover)), `Couverture de ${seed.title}`);

  const uploaded = new Map<string, string>(); // ancien chemin → /uploads/…
  const volumeIds = new Map<number, number>();
  let chapters = 0;
  for (const relative of await walk(path.join(DATA, "novels", seed.slug))) {
    const location = locate(relative);
    if (!location) {
      console.warn(`  ! ${relative} : nom hors convention, ignoré`);
      continue;
    }
    const { meta, body } = splitFrontMatter(await fs.readFile(path.join(DATA, "novels", seed.slug, relative), "utf8"));
    if (!body) continue;

    let volumeId = volumeIds.get(location.volume);
    if (!volumeId) {
      volumeId = Number(
        db
          .prepare("INSERT INTO volume (novelId, number, title) VALUES (?, ?, ?)")
          .run(novelId, location.volume, meta.volume ?? "").lastInsertRowid,
      );
      volumeIds.set(location.volume, volumeId);
    }

    // Les illustrations passent en WebP dans data/uploads/ ; le texte pointe vers leur nouvelle adresse.
    let content = body;
    for (const [whole, alt, src] of body.matchAll(IMAGE)) {
      const source = src.replace(/\\/g, "/").replace(/^\/?assets\/illustrations\//, "");
      if (!uploaded.has(source)) {
        const input = await fs.readFile(path.join(DATA, "illustrations", source));
        const image = await saveImage(owner, "illustration", input, alt || "Illustration");
        uploaded.set(source, `/uploads/${image.file}`);
      }
      content = content.replace(whole, `![${alt || "Illustration"}](${uploaded.get(source)})`);
    }

    const names = meta.traducteurs || meta.traducteur || "";
    const team = meta.equipe || meta.traduction || "";
    const translators = names && team ? `${names} (${team})` : names || team;
    const download = /^https?:\/\//.test(meta.telechargement ?? "") ? meta.telechargement : "";
    const date = toSqlDate(meta.date) ?? "2026-08-15 12:00:00";
    const slug = location.label.startsWith("Tome") ? `tome-${location.volume}` : `tome-${location.volume}-${slugify(location.label)}`;
    db.prepare(
      `INSERT INTO chapter (novelId, volumeId, slug, position, label, title, content, published, translators, downloadUrl, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(novelId, volumeId, slug, location.position, location.label, meta.titre ?? "", content,
      meta.statut === "Publié" ? 1 : 0, translators, download, date, date);
    chapters++;
  }
  console.log(`✓ ${seed.title} : ${chapters} chapitre(s), ${uploaded.size} illustration(s)`);
}

export async function seedNovels() {
  for (const seed of novels) await seedNovel(seed);
}
