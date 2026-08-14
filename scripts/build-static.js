// Génère dans dist/ un site entièrement statique, publiable sur GitHub Pages.
// Les données proviennent du même store que le serveur : content/ reste la source du texte.
const fs = require('node:fs');
const path = require('node:path');
const { state } = require('../server/repositories/store');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist');
const PUBLIC = path.join(ROOT, 'public');

// Pages qui n'ont aucun sens sans serveur : comptes, bibliothèque personnelle, administration.
const EXCLUDED_PAGES = new Set([
  'login.html', 'register.html', 'profile.html', 'forgot-password.html', 'reset-password.html',
  'favorites.html', 'reading-list.html', 'history.html'
]);
const EXCLUDED_DIRS = new Set(['admin']);
const EXCLUDED_SCRIPTS = new Set(['admin.js', 'reset-password.js']);

const write = (relative, data) => {
  const target = path.join(OUT, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof data === 'string' ? data : JSON.stringify(data));
};

function copyTree(from, to, insideDir = '') {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!insideDir && EXCLUDED_DIRS.has(entry.name)) continue;
      copyTree(path.join(from, entry.name), path.join(to, entry.name), insideDir || entry.name);
      continue;
    }
    if (!insideDir && EXCLUDED_PAGES.has(entry.name)) continue;
    if (insideDir === 'js' && EXCLUDED_SCRIPTS.has(entry.name)) continue;
    fs.copyFileSync(path.join(from, entry.name), path.join(to, entry.name));
  }
}

// Reproduit la forme des réponses de l'API pour que le front change le moins possible.
const publicNovel = (novel) => ({
  ...novel,
  volumes: novel.volumes.map((volume) => ({
    ...volume,
    chapters: volume.chapters.map(({ content, ...rest }) => rest)
  }))
});

const allChapters = () => state.novels.flatMap((novel) =>
  novel.volumes.flatMap((volume) => volume.chapters.map((chapter) => ({ novel, volume, chapter }))));

function buildData() {
  const novels = state.novels.filter((n) => !n.deletedAt).map(publicNovel);
  const patches = state.patches.filter((p) => !p.deletedAt);
  write('data/novels.json', novels);
  write('data/patches.json', patches);
  novels.forEach((novel) => write(`data/novels/${novel.slug}.json`, novel));
  patches.forEach((patch) => write(`data/patches/${patch.slug}.json`, patch));

  let published = 0;
  for (const { novel, volume, chapter } of allChapters()) {
    if (chapter.status !== 'Publié') continue; // un brouillon ne doit pas fuiter dans un fichier public
    published += 1;
    const siblings = allChapters()
      .filter((x) => x.novel.id === novel.id && x.chapter.status === 'Publié')
      .map((x) => ({ slug: x.chapter.slug, number: x.chapter.number, title: x.chapter.title, volume: x.volume.number }));
    write(`data/chapters/${chapter.slug}.json`, {
      ...chapter,
      novel: { id: novel.id, slug: novel.slug, title: novel.title, readingUnit: novel.readingUnit || 'chapter' },
      volume: { id: volume.id, number: volume.number, title: volume.title },
      navigation: siblings
    });
  }
  return { novels: novels.length, patches: patches.length, published };
}

// Marque les pages en mode statique et retire les scripts inutiles hors serveur.
function patchPages(dir = OUT) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { patchPages(full); continue; }
    if (!entry.name.endsWith('.html')) continue;
    let html = fs.readFileSync(full, 'utf8');
    html = html.replace('<script src="/js/app.js" defer>', '<script>window.SAINT_ERESIA_STATIC = true;</script><script src="/js/app.js" defer>');
    html = html.replace('<script src="/js/reader.js" defer>', '<script>window.SAINT_ERESIA_STATIC = true;</script><script src="/js/reader.js" defer>');
    html = html.replace(/http:\/\/localhost:3000/g, SITE_URL);
    fs.writeFileSync(full, html);
  }
}

const SITE_URL = process.env.SITE_URL || 'https://saint-eresia.github.io';

function run() {
  fs.rmSync(OUT, { recursive: true, force: true });
  copyTree(PUBLIC, OUT);
  const counts = buildData();
  patchPages();
  fs.writeFileSync(path.join(OUT, '.nojekyll'), ''); // sinon GitHub Pages ignore certains fichiers
  console.log(`dist/ généré : ${counts.novels} roman(s), ${counts.patches} patch(s), ${counts.published} section(s) publiée(s)`);
  if (!counts.published) console.warn('  ! aucune section publiée : le lecteur n’aura rien à afficher tant que content/ est vide');
}

run();
