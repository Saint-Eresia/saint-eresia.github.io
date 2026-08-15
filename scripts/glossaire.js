// Extrait les termes récurrents d'un texte source pour préparer un glossaire de traduction.
// Ne traduit rien : repère ce qui doit être tranché une fois pour toutes, puis appliqué partout.
// Usage : node scripts/glossaire.js <dossier|fichier.md> [--sortie glossaire.md] [--min 3]
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const option = (name, fallback) => { const at = args.indexOf(`--${name}`); return at === -1 ? fallback : args[at + 1] || fallback; };
if (!input) { console.error('Usage : node scripts/glossaire.js <dossier|fichier.md> [--sortie glossaire.md] [--min 3]'); process.exit(1); }

const MIN = Number(option('min', 3));
// Mots courants en tête de phrase : ce ne sont pas des noms propres.
const STOP = new Set(['The','A','An','And','But','I','It','He','She','They','We','You','This','That','There','Then','When','What','Why','How','If','As','At','In','On','So','No','Yes','My','His','Her','Their','Our','Your','Of','To','For','With','After','Before','While','Even','Just','Well','Now','Still','Though','Since','However','Because','Although','Anyway','Maybe','Perhaps','Suddenly','Finally','Meanwhile','Actually','Really','Only','Once','Every','Some','All','Both','Each','Never','Always','Nothing','Something','Someone','Everyone','Here','Where','Which','Who','Whose','Can','Could','Would','Should','Will','Shall','May','Might','Must','Did','Does','Do','Was','Were','Is','Are','Am','Be','Been','Have','Has','Had','Let','Get','Got','Go','Went','Come','Came','Said','Say','Says','Look','Looked','Think','Thought','Know','Knew','See','Saw','Take','Took','Make','Made','One','Two','Three','First','Last','Next','Next','Chapter','Prologue','Epilogue','Page','Cover','Inside','Flap','Translator','Editor','Illustration']);

const files = fs.statSync(input).isDirectory()
  ? fs.readdirSync(input).filter((n) => /\.(md|txt)$/i.test(n)).map((n) => path.join(input, n))
  : [input];

const counts = new Map();
const samples = new Map();
for (const file of files) {
  const body = fs.readFileSync(file, 'utf8').replace(/^---[\s\S]*?---\n/, '');
  for (const sentence of body.split(/(?<=[.!?…»"])\s+/)) {
    // Un nom propre : majuscule, pas en tête de phrase, ou séquence de mots capitalisés.
    const matches = sentence.matchAll(/\b([A-Z][a-z]{2,}(?:[- ][A-Z][a-z]{2,}){0,3})\b/g);
    for (const match of matches) {
      const term = match[1];
      if (STOP.has(term.split(/[- ]/)[0])) continue;
      if (match.index === 0 && !term.includes(' ')) continue; // début de phrase : ambigu
      counts.set(term, (counts.get(term) || 0) + 1);
      if (!samples.has(term)) samples.set(term, sentence.trim().slice(0, 90));
    }
  }
}

const retained = [...counts.entries()].filter(([, n]) => n >= MIN).sort((a, b) => b[1] - a[1]);
const lines = ['# Glossaire de traduction', '',
  'Termes récurrents relevés dans le texte source. Tranchez la colonne « français » une fois :',
  'c\'est ce qui fait qu\'un tome traduit à plusieurs se lit d\'une seule voix.', '',
  '| Terme source | Occurrences | Français | Note |', '|---|---|---|---|',
  ...retained.map(([term, n]) => `| ${term} | ${n} |  |  |`)];
const out = option('sortie', 'glossaire.md');
fs.writeFileSync(out, `${lines.join('\n')}\n`);
console.log(`${retained.length} terme(s) retenu(s) sur ${counts.size} repéré(s) → ${out}`);
console.log(`  Les 8 plus fréquents : ${retained.slice(0, 8).map(([t, n]) => `${t} (${n})`).join(', ')}`);
