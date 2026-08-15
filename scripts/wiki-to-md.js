// Convertit une page de chapitre d'un wiki de fantraduction en Markdown au format content/.
// Vous restez responsable de ce que vous importez : vérifiez la licence de la source.
// Usage : node scripts/wiki-to-md.js <url> --sortie content/<roman>/volume-01/chapitre-02.md
//   --titre <texte>        titre du chapitre (sinon, celui de la page)
//   --volume <texte>       titre du tome, écrit dans l'en-tête
//   --traducteurs <liste>  noms séparés par des virgules
//   --equipe <texte>       équipe créditée (défaut : Baka-Tsuki)
//   --sans-illustrations   n'télécharge pas les images
const fs = require('node:fs');
const path = require('node:path');
const { parseDocument } = require('htmlparser2');

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const option = (name, fallback = '') => {
  const at = args.indexOf(`--${name}`);
  return at === -1 ? fallback : (args[at + 1] || '').startsWith('--') ? fallback : args[at + 1] || fallback;
};
const flag = (name) => args.includes(`--${name}`);

if (!url || !option('sortie')) {
  console.error('Usage : node scripts/wiki-to-md.js <url> --sortie content/<roman>/volume-01/chapitre-02.md');
  process.exit(1);
}

const text = (node) => {
  if (node.type === 'text') return node.data;
  if (!node.children) return '';
  return node.children.map(text).join('');
};
const attr = (node, name) => (node.attribs || {})[name] || '';
const hasClass = (node, name) => attr(node, 'class').split(/\s+/).includes(name);
const findAll = (node, test, out = []) => {
  if (test(node)) out.push(node);
  (node.children || []).forEach((child) => findAll(child, test, out));
  return out;
};

const escapeMd = (raw) => raw.replace(/\s+/g, ' ').replace(/([*_`#])/g, '\$1').trim();

// Rend le contenu en ligne : gras, italique, et le texte brut du reste.
function inline(node) {
  if (node.type === 'text') return escapeMd(node.data);
  const name = (node.name || '').toLowerCase();
  const inner = (node.children || []).map(inline).join('');
  if (!inner.trim()) return '';
  if (name === 'i' || name === 'em') return `*${inner}*`;
  if (name === 'b' || name === 'strong') return `**${inner}**`;
  if (name === 'br') return ' ';
  return inner;
}

// Éléments de navigation du wiki : sommaire, bandeaux, catégories, liens d'édition.
const NOISE = ['toc', 'mw-editsection', 'navbox', 'catlinks', 'printfooter', 'mw-jump-link', 'noprint', 'thumbcaption'];
const isNoise = (node) => NOISE.some((name) => hasClass(node, name)) || ['table', 'style', 'script', 'sup'].includes((node.name || '').toLowerCase());

function blocksFrom(root, images) {
  const out = [];
  for (const node of root.children || []) {
    if (node.type !== 'tag' || isNoise(node)) continue;
    const name = node.name.toLowerCase();
    if (name === 'h2' || name === 'h3') {
      const heading = escapeMd(text(node));
      if (heading) out.push(`${name === 'h2' ? '##' : '###'} ${heading}`);
      continue;
    }
    if (name === 'p') {
      // Une image seule dans un paragraphe est une illustration.
      const picture = findAll(node, (x) => x.type === 'tag' && x.name === 'img')[0];
      const body = inline(node).trim();
      if (picture) images.push(attr(picture, 'src'));
      if (body) out.push(body);
      continue;
    }
    if (name === 'blockquote' || name === 'dd') {
      const body = inline(node).trim();
      if (body) out.push(body.split('\n').map((line) => `> ${line}`).join('\n'));
      continue;
    }
    if (name === 'ul' || name === 'ol') {
      const items = (node.children || []).filter((x) => x.type === 'tag' && x.name === 'li').map((x) => inline(x).trim()).filter(Boolean);
      if (items.length) out.push(items.map((item, i) => (name === 'ul' ? `- ${item}` : `${i + 1}. ${item}`)).join('\n'));
      continue;
    }
    if (name === 'hr') { out.push('---'); continue; }
    if (name === 'div' || name === 'center') {
      findAll(node, (x) => x.type === 'tag' && x.name === 'img').forEach((x) => images.push(attr(x, 'src')));
      out.push(...blocksFrom(node, images));
    }
  }
  return out;
}

const frontMatter = (meta) => ['---', `titre: ${meta.titre}`, `volume: ${meta.volume}`, 'statut: Brouillon',
  `traducteurs: ${meta.traducteurs}`, `equipe: ${meta.equipe}`, `source: ${meta.source}`, 'date:', '---', ''].join('\n');

async function run() {
  const out = option('sortie');
  const novel = path.basename(path.dirname(path.dirname(path.resolve(out))));
  const response = await fetch(url, { headers: { 'User-Agent': 'Saint-Eresia-import/1.0' } });
  if (!response.ok) { console.error(`Page inaccessible (${response.status}).`); process.exitCode = 1; return; }
  const document = parseDocument(await response.text());

  const body = findAll(document, (n) => n.type === 'tag' && hasClass(n, 'mw-parser-output'))[0];
  if (!body) { console.error('Contenu introuvable : cette page n’a pas la structure attendue.'); process.exitCode = 1; return; }
  const pageTitle = escapeMd(text(findAll(document, (n) => n.type === 'tag' && n.name === 'h1')[0] || { children: [] }));

  const images = [];
  const blocks = blocksFrom(body, images);
  if (!blocks.length) { console.error('Aucun texte exploitable : la page est probablement vide ou en brouillon.'); process.exitCode = 1; return; }

  // Illustrations : téléchargées à côté du texte, référencées en chemin absolu.
  const urls = [];
  if (!flag('sans-illustrations')) {
    const dir = path.join(__dirname, '..', 'public', 'assets', 'illustrations', novel);
    const base = path.basename(out).replace(/\.md$/i, '');
    for (const [index, src] of images.entries()) {
      const full = src.startsWith('//') ? `https:${src}` : new URL(src, url).href;
      try {
        const image = await fetch(full, { headers: { 'User-Agent': 'Saint-Eresia-import/1.0' } });
        if (!image.ok) continue;
        const ext = (path.extname(new URL(full).pathname) || '.jpg').split('?')[0];
        const name = `${base}-${String(index + 1).padStart(2, '0')}${ext}`;
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, name), Buffer.from(await image.arrayBuffer()));
        urls.push(`/assets/illustrations/${novel}/${name}`);
      } catch { /* image inaccessible : on continue sans elle */ }
    }
  }

  const meta = {
    titre: option('titre') || pageTitle, volume: option('volume'),
    traducteurs: option('traducteurs'), equipe: option('equipe', 'Baka-Tsuki'), source: url
  };
  const markdown = [...urls.map((u) => `![](${u})`), ...blocks].join('\n\n');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${frontMatter(meta)}\n${markdown}\n`);
  const words = blocks.join(' ').split(/\s+/).filter(Boolean).length;
  console.log(`Écrit : ${out}`);
  console.log(`  ${blocks.length} bloc(s) · ${words} mot(s) · ${urls.length} illustration(s)`);
  console.log('  Statut « Brouillon » : relisez, complétez les crédits, puis passez en « Publié ».');
}

run().catch((error) => { console.error(error.message); process.exitCode = 1; });
