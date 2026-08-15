// Prépare un texte source pour un moteur de traduction, puis recolle sa sortie.
// Le passage machine se fait chez vous : ce script ne fait que découper et rassembler.
//
//   node scripts/decouper.js <dossier> --sortie _reference/a-traduire   [--taille 3500]
//   node scripts/decouper.js --recoller _reference/traduit --sortie content/<roman>/volume-04
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const option = (name, fallback) => { const at = args.indexOf(`--${name}`); return at === -1 ? fallback : args[at + 1] || fallback; };
const out = option('sortie');
const recoller = option('recoller', null);
const input = args.find((a) => !a.startsWith('--') && a !== out && a !== recoller);

if (!out || (!input && !recoller)) {
  console.error('Découper  : node scripts/decouper.js <dossier> --sortie <dossier> [--taille 3500]');
  console.error('Recoller  : node scripts/decouper.js --recoller <dossier> --sortie <dossier>');
  process.exit(1);
}

const SEP = '\n\n<<<§>>>\n\n'; // marqueur conservé par les moteurs de traduction

// Découpe sur les frontières de paragraphes, jamais au milieu d'une phrase.
function morceaux(body, limite) {
  const blocs = body.split(/\n{2,}/).filter((b) => b.trim());
  const out = [];
  let courant = [];
  let taille = 0;
  for (const bloc of blocs) {
    if (taille + bloc.length > limite && courant.length) { out.push(courant.join('\n\n')); courant = []; taille = 0; }
    courant.push(bloc);
    taille += bloc.length + 2;
  }
  if (courant.length) out.push(courant.join('\n\n'));
  return out;
}

const frontMatter = (raw) => (raw.match(/^---[\s\S]*?---\n/) || [''])[0];
const corps = (raw) => raw.replace(/^---[\s\S]*?---\n/, '').trim();

function decouper() {
  const limite = Number(option('taille', 3500));
  const fichiers = fs.statSync(input).isDirectory()
    ? fs.readdirSync(input).filter((n) => /\.(md|txt)$/i.test(n)).sort().map((n) => path.join(input, n))
    : [input];
  fs.mkdirSync(out, { recursive: true });
  let total = 0;
  for (const fichier of fichiers) {
    const raw = fs.readFileSync(fichier, 'utf8');
    const parts = morceaux(corps(raw), limite);
    const base = path.basename(fichier).replace(/\.(md|txt)$/i, '');
    // L'en-tête est mis de côté : il ne doit pas passer dans le moteur.
    fs.writeFileSync(path.join(out, `${base}.entete`), frontMatter(raw));
    parts.forEach((part, i) => fs.writeFileSync(path.join(out, `${base}--${String(i + 1).padStart(3, '0')}.txt`), `${part}\n`));
    total += parts.length;
    console.log(`  ${base} → ${parts.length} morceau(x)`);
  }
  console.log(`${total} morceau(x) écrit(s) dans ${out} (max ${limite} caractères).`);
  console.log('Traduisez ces .txt avec l’outil de votre choix, en gardant les noms de fichiers.');
}

function recollerTout() {
  const fichiers = fs.readdirSync(recoller).filter((n) => /--\d{3}\.txt$/i.test(n)).sort();
  const groupes = new Map();
  for (const nom of fichiers) {
    const base = nom.replace(/--\d{3}\.txt$/i, '');
    if (!groupes.has(base)) groupes.set(base, []);
    groupes.get(base).push(path.join(recoller, nom));
  }
  fs.mkdirSync(out, { recursive: true });
  for (const [base, parts] of groupes) {
    const entete = path.join(recoller, `${base}.entete`);
    const tete = fs.existsSync(entete) ? fs.readFileSync(entete, 'utf8') : '---\ntitre:\nstatut: Brouillon\n---\n';
    const body = parts.map((p) => fs.readFileSync(p, 'utf8').trim()).join('\n\n');
    fs.writeFileSync(path.join(out, `${base}.md`), `${tete}\n${body}\n`);
    console.log(`  ${base}.md ← ${parts.length} morceau(x)`);
  }
  console.log(`${groupes.size} fichier(s) reconstitué(s) dans ${out}, en statut Brouillon.`);
}

recoller ? recollerTout() : decouper();
