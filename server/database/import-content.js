// Lit le dossier content/ et régénère server/data/content.json, chargé par le store au démarrage.
// Le chemin du fichier détermine le slug : il fait office d'URL publique et de clé d'import.
const fs = require('node:fs');
const path = require('node:path');
const { cleanText, cleanChapterHtml, cleanDate } = require('../utils/validation');

const ROOT = path.join(__dirname, '..', '..', 'content');
const OUT = path.join(__dirname, '..', 'data', 'content.json');
const STATUSES = ['Brouillon', 'Programmé', 'Publié', 'Archivé'];

// En-tête `clé: valeur` entre deux lignes ---, puis le corps.
function splitFrontMatter(raw) {
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) return { meta: {}, body: text.trim() };
  const meta = {};
  for (const line of match[1].split('\n')) {
    const at = line.indexOf(':');
    if (at > 0) meta[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
  }
  return { meta, body: text.slice(match[0].length).trim() };
}

const inline = (text) => cleanText(text, 20000)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>');

// Markdown volontairement restreint : ce qui dépasse est retiré par cleanChapterHtml.
function toHtml(body) {
  const blocks = body.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const html = blocks.map((block) => {
    if (/^---+$/.test(block)) return '<hr>';
    if (block.startsWith('### ')) return `<h3>${inline(block.slice(4))}</h3>`;
    if (block.startsWith('## ')) return `<h2>${inline(block.slice(3))}</h2>`;
    if (block.split('\n').every((line) => line.startsWith('> '))) {
      return `<blockquote>${inline(block.split('\n').map((l) => l.slice(2)).join(' '))}</blockquote>`;
    }
    if (block.split('\n').every((line) => /^[-*] /.test(line))) {
      return `<ul>${block.split('\n').map((l) => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
    }
    if (block.split('\n').every((line) => /^\d+\.\s/.test(line))) {
      return `<ol>${block.split('\n').map((l) => `<li>${inline(l.replace(/^\d+\.\s/, ''))}</li>`).join('')}</ol>`;
    }
    return `<p>${inline(block).split('\n').join('<br>')}</p>`;
  }).join('');
  return cleanChapterHtml(html);
}

const countWords = (body) => body.split(/\s+/).filter(Boolean).length;

// content/<roman>/tome-01.md            -> <roman>-tome-1        (roman lu au tome)
// content/<roman>/volume-01/chapitre-03.md -> <roman>-v1-ch3     (roman lu au chapitre)
function parseLocation(novelSlug, relative) {
  const parts = relative.split(path.sep);
  if (parts.length === 1) {
    const match = parts[0].match(/^tome-(\d+)\.(md|txt)$/i);
    if (!match) return null;
    const volume = Number(match[1]);
    return { volume, number: 1, slug: `${novelSlug}-tome-${volume}`, unit: 'volume' };
  }
  if (parts.length === 2) {
    const volumeMatch = parts[0].match(/^volume-(\d+)$/i);
    const chapterMatch = parts[1].match(/^chapitre-(\d+)\.(md|txt)$/i);
    if (!volumeMatch || !chapterMatch) return null;
    const volume = Number(volumeMatch[1]), number = Number(chapterMatch[1]);
    return { volume, number, slug: `${novelSlug}-v${volume}-ch${number}`, unit: 'chapter' };
  }
  return null;
}

const walk = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return walk(full, base);
  return /\.(md|txt)$/i.test(entry.name) ? [path.relative(base, full)] : [];
});

function run() {
  if (!fs.existsSync(ROOT)) { console.error(`Dossier introuvable : ${ROOT}`); process.exitCode = 1; return; }
  const sections = [];
  const problems = [];
  for (const novelSlug of fs.readdirSync(ROOT).filter((name) => fs.statSync(path.join(ROOT, name)).isDirectory())) {
    for (const relative of walk(path.join(ROOT, novelSlug))) {
      const location = parseLocation(novelSlug, relative);
      if (!location) { problems.push(`${novelSlug}/${relative} — nom de fichier hors convention, ignoré`); continue; }
      const { meta, body } = splitFrontMatter(fs.readFileSync(path.join(ROOT, novelSlug, relative), 'utf8'));
      if (!body) { problems.push(`${novelSlug}/${relative} — fichier vide, ignoré`); continue; }
      const status = STATUSES.includes(meta.statut) ? meta.statut : 'Brouillon';
      const words = countWords(body);
      sections.push({
        novelSlug, slug: location.slug, volume: location.volume, number: location.number, unit: location.unit,
        title: cleanText(meta.titre || '', 180), status,
        translator: cleanText(meta.traducteur || '', 180) || null,
        publishedAt: cleanDate(meta.date) || null,
        wordCount: words, readingTime: Math.max(1, Math.round(words / 220)),
        content: toHtml(body), source: `content/${novelSlug}/${relative.split(path.sep).join('/')}`
      });
    }
  }
  sections.sort((a, b) => a.novelSlug.localeCompare(b.novelSlug) || a.volume - b.volume || a.number - b.number);
  const duplicates = sections.map((s) => s.slug).filter((slug, i, all) => all.indexOf(slug) !== i);
  if (duplicates.length) { console.error(`Slugs en double : ${[...new Set(duplicates)].join(', ')}`); process.exitCode = 1; return; }
  fs.writeFileSync(OUT, `${JSON.stringify({ generatedFrom: 'content/', sections }, null, 2)}\n`);
  const published = sections.filter((s) => s.status === 'Publié').length;
  console.log(`${sections.length} section(s) importée(s), dont ${published} publiée(s) → server/data/content.json`);
  problems.forEach((problem) => console.warn(`  ! ${problem}`));
}

run();
