// Convertit un PDF de roman en Markdown au format attendu par content/.
// Usage : node scripts/pdf-to-md.js <fichier.pdf> [options]
//   --sortie <chemin>     fichier .md à écrire (défaut : à côté du PDF)
//   --decouper            un fichier chapitre-NN.md par chapitre, dans --dossier
//   --dossier <chemin>    dossier de sortie quand on découpe
//   --titre <texte>       valeur du champ titre de l'en-tête
//   --traducteur <texte>  valeur du champ traducteur (défaut : Saint Eresia)
//   --statut <texte>      Brouillon (défaut), Publié ou Archivé
const fs = require('node:fs');
const sharp = require('sharp');
const path = require('node:path');

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const option = (name, fallback = '') => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : (args[at + 1] || '').startsWith('--') ? fallback : args[at + 1] || fallback;
};
const flag = (name) => args.includes(`--${name}`);

if (!input) {
  console.error('Usage : node scripts/pdf-to-md.js <fichier.pdf> [--sortie x.md] [--decouper --dossier ...]');
  process.exit(1);
}

// Une ligne = les fragments de texte partageant la même ordonnée.
function toLines(items) {
  const lines = [];
  for (const item of items) {
    if (!item.str) continue;
    const y = Math.round(item.transform[5]);
    const x = item.transform[4];
    const size = Math.round(Math.abs(item.transform[0]) * 10) / 10;
    const previous = lines[lines.length - 1];
    if (previous && Math.abs(previous.y - y) <= 2) {
      previous.parts.push({ x, str: item.str, size, font: item.fontName });
      previous.size = Math.max(previous.size, size);
    } else {
      lines.push({ y, x, size, parts: [{ x, str: item.str, size, font: item.fontName }] });
    }
  }
  // L'ordre d'extraction ne suit pas la page : on remet de haut en bas (Y décroissant en PDF).
  lines.sort((a, b) => b.y - a.y);
  return lines.map((line) => {
    line.parts.sort((a, b) => a.x - b.x);
    line.text = line.parts.map((p) => p.str).join('').replace(/\s+/g, ' ').trim();
    line.x = line.parts[0].x;
    return line;
  }).filter((line) => line.text);
}

// En-têtes, pieds de page et numéros de page : identiques d'une page à l'autre, donc repérables.
// Un titre de chapitre en haut de page ressemble à un en-tête courant : on le protège
// par sa taille de police et par son libellé, sinon plusieurs chapitres se font effacer.
function dropRunningHeads(pages, bodySize) {
  const looksLikeHeading = (line) => line.size > bodySize * 1.1 || HEADING.test(line.text);
  const count = new Map();
  for (const lines of pages) {
    const edges = [...lines.slice(0, 2), ...lines.slice(-2)];
    for (const line of new Set(edges)) {
      if (line.image) continue;
      if (looksLikeHeading(line)) continue;
      const key = line.text.replace(/\d+/g, '#');
      count.set(key, (count.get(key) || 0) + 1);
    }
  }
  const repeated = new Set([...count].filter(([, n]) => n >= Math.max(2, pages.length * 0.5)).map(([key]) => key));
  return pages.map((lines) => lines.filter((line, index) => {
    const nearEdge = index < 2 || index >= lines.length - 2;
    if (line.image) return true;
    if (!nearEdge || looksLikeHeading(line)) return true;
    if (/^[ivxlcdm]+$|^\d{1,4}$|^[-–—\s]*\d{1,4}[-–—\s]*$/i.test(line.text)) return false;
    return !repeated.has(line.text.replace(/\d+/g, '#'));
  }));
}


// Les illustrations sont écrites dans public/assets/... pour être servies par le serveur
// comme par le site statique, et référencées en chemin absolu dans le Markdown.
async function extractImages(page, pageNumber, { dir, urlBase, prefix, OPS }) {
  const ops = await page.getOperatorList();
  const found = [];
  let ctm = [1, 0, 0, 1, 0, 0];
  const stack = [];
  const mul = (m, n) => [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
  ];
  for (let i = 0; i < ops.fnArray.length; i += 1) {
    const fn = ops.fnArray[i];
    if (fn === OPS.save) { stack.push(ctm.slice()); continue; }
    if (fn === OPS.restore) { ctm = stack.pop() || [1, 0, 0, 1, 0, 0]; continue; }
    if (fn === OPS.transform) { ctm = mul(ctm, ops.argsArray[i]); continue; }
    if (fn !== OPS.paintImageXObject) continue;
    const id = ops.argsArray[i][0];
    let obj;
    try { obj = await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('délai dépassé')), 15000); page.objs.get(id, (o) => { clearTimeout(t); res(o); }); }); }
    catch { continue; }
    if (!obj || !obj.data || !obj.width) continue;
    const channels = obj.kind === 3 ? 4 : obj.kind === 2 ? 3 : 0;
    if (!channels || obj.data.length < obj.width * obj.height * channels) continue;
    // Les petites images sont des filets ou des logos, pas des illustrations.
    if (obj.width < 200 || obj.height < 200) continue;
    const name = `${prefix}-p${String(pageNumber).padStart(3, '0')}-${found.length + 1}.webp`;
    fs.mkdirSync(dir, { recursive: true });
    await sharp(Buffer.from(obj.data.buffer, obj.data.byteOffset, obj.width * obj.height * channels),
      { raw: { width: obj.width, height: obj.height, channels } })
      .webp({ quality: 82 }).toFile(path.join(dir, name));
    found.push({ y: Math.max(ctm[5], ctm[5] + ctm[3]), url: `${urlBase}/${name}`, width: obj.width, height: obj.height });
  }
  return found;
}
const HEADING = /^(chapitre|chapter|prologue|épilogue|epilogue|interlude|partie|tome|volume)\b/i;
const SCENE_BREAK = /^[\s*◇◆●○■□·・…\-–—=~]{3,}$/;

// Les paragraphes se déduisent de l'espacement vertical et du retrait de première ligne.
// L'interligne courant se déduit du document : un saut nettement plus grand marque un paragraphe.
function medianGap(allLines, bodySize) {
  const lines = allLines.filter((l) => !l.image);
  const gaps = [];
  for (let i = 1; i < lines.length; i += 1) {
    const gap = lines[i - 1].y - lines[i].y;
    if (gap > 1 && gap < bodySize * 4) gaps.push(gap);
  }
  if (!gaps.length) return bodySize * 1.2;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

function toBlocks(lines, bodySize, lineGap) {
  const blocks = [];
  let current = null;
  const textLines = lines.filter((l) => !l.image);
  const left = Math.min(...textLines.map((l) => l.x));
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const previous = lines[i - 1];
    const gap = previous ? previous.y - line.y : 0;
    const isHeading = line.size > bodySize * 1.15 || HEADING.test(line.text);
    if (line.image) { blocks.push({ type: 'image', image: line.image }); current = null; continue; }
    if (SCENE_BREAK.test(line.text)) { blocks.push({ type: 'break' }); current = null; continue; }
    if (isHeading && line.text.length < 120) {
      blocks.push({ type: 'heading', text: line.text, size: line.size });
      current = null;
      continue;
    }
    const indented = line.x > left + bodySize * 0.6;
    const bigGap = previous && gap > lineGap * 1.45;
    if (!current || indented || bigGap) {
      current = { type: 'paragraph', text: line.text };
      blocks.push(current);
    } else {
      // Mot coupé en fin de ligne : on recolle sans le trait d'union.
      current.text = /[\p{L}]-$/u.test(current.text) && /^[\p{Ll}]/u.test(line.text)
        ? current.text.slice(0, -1) + line.text
        : `${current.text} ${line.text}`;
    }
  }
  return blocks;
}

const escapeMd = (text) => text.replace(/([*_`#])/g, '\$1').replace(/\s+/g, ' ').trim();

function toMarkdown(blocks, { split }) {
  const out = [];
  for (const block of blocks) {
    if (block.type === 'break') { out.push('---'); continue; }
    if (block.type === 'image') { out.push(`![](${block.image.url})`); continue; }
    if (block.type === 'heading') { out.push(`${split ? '#' : '##'} ${escapeMd(block.text)}`); continue; }
    if (block.text.length > 1) out.push(escapeMd(block.text));
  }
  return out.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

const frontMatter = ({ titre, statut, traducteur, date }) =>
  ['---', `titre: ${titre || ''}`, `statut: ${statut}`, `traducteur: ${traducteur}`, `date: ${date || ''}`, '---', ''].join('\n');

const ROOT_PUBLIC = path.join(__dirname, '..', 'public');
async function run() {
  // Dossier des illustrations : sous public/assets pour être servi par le serveur et le site statique.
  const imageTarget = (OPS) => {
    const outPath = flag('decouper') ? option('dossier', path.dirname(input)) : option('sortie', input.replace(/\.pdf$/i, '.md'));
    const novel = path.basename(flag('decouper') ? path.dirname(path.resolve(outPath)) : path.dirname(path.resolve(outPath)));
    const dir = option('illustrations', path.join(ROOT_PUBLIC, 'assets', 'illustrations', novel));
    const urlBase = `/assets/illustrations/${novel}`;
    const prefix = path.basename(outPath).replace(/\.md$/i, '') || 'illus';
    return { dir, urlBase, prefix, OPS };
  };
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(input));
  const document = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

  const pages = [];
  for (let n = 1; n <= document.numPages; n += 1) {
    const page = await document.getPage(n);
    const content = await page.getTextContent();
    const lines = toLines(content.items);
    if (!flag('sans-illustrations')) {
      const images = await extractImages(page, n, imageTarget(pdfjs.OPS));
      for (const image of images) lines.push({ y: image.y, x: 0, size: 0, parts: [], text: '', image });
      lines.sort((a, b) => b.y - a.y);
    }
    pages.push(lines);
  }
  // Taille de corps = celle qui porte le plus de texte ; les titres s'en écartent.
  const measure = (all) => { const sizes = new Map(); all.forEach((l) => sizes.set(l.size, (sizes.get(l.size) || 0) + l.text.length)); return [...sizes].sort((a, b) => b[1] - a[1])[0][0]; };
  const bodySize = measure(pages.flat());
  const cleaned = dropRunningHeads(pages, bodySize);
  const lines = cleaned.flat();
  if (!lines.length) {
    console.error('Aucun texte extrait. Ce PDF est probablement un scan : il faudrait une reconnaissance de caractères (OCR).');
    process.exit(2);
  }
  // Taille de corps = la plus fréquente, les titres s'en écartent.



  const lineGap = medianGap(lines, bodySize);
  const blocks = toBlocks(lines, bodySize, lineGap);
  const meta = { titre: option('titre'), statut: option('statut', 'Brouillon'), traducteur: option('traducteur', 'Saint Eresia'), date: option('date') };
  const stats = { pages: document.numPages, titres: blocks.filter((b) => b.type === 'heading').length, paragraphes: blocks.filter((b) => b.type === 'paragraph').length };

  if (flag('decouper')) {
    const dir = option('dossier', path.dirname(input));
    fs.mkdirSync(dir, { recursive: true });
    // Chaque titre de niveau supérieur ouvre un nouveau fichier.
    const parts = [];
    for (const block of blocks) {
      if (block.type === 'heading' && (!parts.length || parts[parts.length - 1].blocks.length)) {
        // « Chapitre 3 » tout court n'est pas un titre : le site affiche déjà le numéro.
        const bare = /^(chapitre|chapter)\s*\d+\s*$/i.test(block.text.trim());
        parts.push({ titre: bare ? '' : block.text, blocks: [] });
        continue;
      }
      if (!parts.length) parts.push({ titre: '', blocks: [] });
      parts[parts.length - 1].blocks.push(block);
    }
    parts.forEach((part, index) => {
      const file = path.join(dir, `chapitre-${String(index + 1).padStart(2, '0')}.md`);
      fs.writeFileSync(file, `${frontMatter({ ...meta, titre: meta.titre || part.titre })}\n${toMarkdown(part.blocks, { split: true })}\n`);
    });
    console.log(`${parts.length} chapitre(s) écrit(s) dans ${dir}`);
  } else {
    const out = option('sortie', input.replace(/\.pdf$/i, '.md'));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${frontMatter(meta)}\n${toMarkdown(blocks, { split: false })}\n`);
    console.log(`Écrit : ${out}`);
  }
  console.log(`  ${stats.pages} page(s) lue(s) · ${stats.titres} titre(s) · ${stats.paragraphes} paragraphe(s) · corps ${bodySize}pt`);
  console.log('  Relisez le résultat : découpage des paragraphes et italiques demandent presque toujours une reprise.');
}

run().catch((error) => { console.error(error.message); process.exitCode = 1; });
