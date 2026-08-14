const express = require('express');
const { state, nextId, log } = require('../repositories/store');
const { requireAuth } = require('../middleware/auth');
const { requireMinimumRole } = require('../middleware/roles');
const { cleanText, cleanInt, cleanList, cleanDate, slugify } = require('../utils/validation');

const router = express.Router();

const STATUSES = ['En développement', 'Alpha', 'Bêta', 'Stable', 'Terminé', 'Obsolète', 'Abandonné'];
const TYPES = ['Traduction complète', 'Traduction partielle', 'Correctif', 'Interface', 'Compatibilité', 'Patch technique', 'Voix', 'Restauration de contenu'];
const TEXT_FIELDS = { title: 180, synopsis: 4000, currentVersion: 60, gameVersion: 120, platform: 180, developer: 180, publisher: 180, engine: 100, team: 180, originalLanguage: 60, patchLanguage: 60, vndbId: 30, vndbUrl: 300, fileSize: 40, checksum: 64, cover: 300 };
const LIST_FIELDS = { alternativeTitles: 10, systems: 8, requirements: 15, instructions: 20, changelog: 30, warnings: 10 };
// Axes d'avancement suivis par l'équipe. `progress` en est toujours la moyenne : ne jamais l'éditer directement.
const AXES = ['translation', 'images', 'technical', 'proofreading'];
const emptyAxes = () => Object.fromEntries(AXES.map((axis) => [axis, 0]));
const overall = (axes) => Math.round(AXES.reduce((total, axis) => total + (axes[axis] || 0), 0) / AXES.length);
const today = () => new Date().toISOString().slice(0, 10);
const allVersions = () => state.patches.flatMap((patch) => patch.versions || []);
const findPatch = (id) => state.patches.find((patch) => patch.id === Number(id) && !patch.deletedAt);

// Applique les champs fournis sur un patch. Retourne un message d'erreur, ou null si tout est valide.
function applyFields(item, body, { isCreate = false } = {}) {
  if (body.slug !== undefined || isCreate) {
    const slug = slugify(body.slug || body.title || item.title);
    if (!slug) return 'Le slug ne peut pas être vide.';
    if (state.patches.some((patch) => patch.slug === slug && patch.id !== item.id)) return 'Ce slug est déjà utilisé par un autre patch.';
    item.slug = slug;
  }
  for (const [key, max] of Object.entries(TEXT_FIELDS)) if (body[key] !== undefined) item[key] = cleanText(body[key], max);
  for (const [key, maxItems] of Object.entries(LIST_FIELDS)) if (body[key] !== undefined) item[key] = cleanList(body[key], maxItems);
  if (body.status !== undefined) { if (!STATUSES.includes(body.status)) return `Statut invalide. Valeurs acceptées : ${STATUSES.join(', ')}.`; item.status = body.status; }
  if (body.type !== undefined) { if (!TYPES.includes(body.type)) return `Type de patch invalide. Valeurs acceptées : ${TYPES.join(', ')}.`; item.type = body.type; }
  if (body.axes !== undefined || AXES.some((axis) => body[axis] !== undefined)) {
    const source = body.axes && typeof body.axes === 'object' ? body.axes : body;
    const axes = { ...emptyAxes(), ...item.axes };
    for (const axis of AXES) {
      if (source[axis] === undefined) continue;
      const value = cleanInt(source[axis], 0, 100);
      if (value === null) return `L'avancement « ${axis} » doit être un nombre entre 0 et 100.`;
      axes[axis] = value;
    }
    item.axes = axes;
  }
  item.axes = { ...emptyAxes(), ...item.axes };
  item.progress = overall(item.axes); // dérivé : la saisie se fait uniquement axe par axe
  if (!item.title) return 'Titre requis.';
  if (body.platform !== undefined && body.systems === undefined) item.systems = item.platform.split('/').map((entry) => entry.trim()).filter(Boolean);
  item.updatedAt = today();
  return null;
}

router.get('/', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1), limit = Math.min(24, Math.max(1, Number(req.query.limit) || 8));
  const search = String(req.query.search || '').toLowerCase(); let items = state.patches.filter((p) => !p.deletedAt);
  if (search) items = items.filter((p) => [p.title, ...p.alternativeTitles, p.developer, p.publisher, p.team, p.vndbId].join(' ').toLowerCase().includes(search));
  ['platform','status','engine','team','type'].forEach((key) => { if (req.query[key]) items = items.filter((p) => String(p[key]).includes(req.query[key])); });
  const sorters = { downloads: (a,b) => b.downloads-a.downloads, rating: (a,b) => b.rating-a.rating, alpha: (a,b) => a.title.localeCompare(b.title), progress: (a,b) => b.progress-a.progress, published: (a,b) => b.updatedAt.localeCompare(a.updatedAt), updated: (a,b) => b.updatedAt.localeCompare(a.updatedAt) };
  items.sort(sorters[req.query.sort] || sorters.updated); const total = items.length;
  res.json({ items: items.slice((page-1)*limit,page*limit), pagination: { page, limit, total, pages: Math.ceil(total/limit) } });
});

router.get('/:slug', (req, res) => { const item = state.patches.find((p) => p.slug === req.params.slug && !p.deletedAt); if (!item) return res.status(404).json({ error: 'Patch introuvable.' }); res.json(item); });

router.post('/', requireAuth, requireMinimumRole('EDITOR'), (req, res) => {
  if (req.body.rightsConfirmed !== true) return res.status(422).json({ error: 'La confirmation des droits est obligatoire.' });
  const title = cleanText(req.body.title, 180); if (!title) return res.status(422).json({ error: 'Titre requis.' });
  const item = {
    id: nextId(state.patches), title, slug: '', alternativeTitles: [], vndbId: '', vndbUrl: '',
    developer: '', publisher: '', engine: '', platform: 'Windows', systems: ['Windows'], gameVersion: '',
    originalLanguage: 'Japonais', patchLanguage: 'Français', team: 'Saint Eresia',
    type: 'Traduction complète', status: 'En développement', axes: emptyAxes(), progress: 0, currentVersion: '0.1.0',
    fileSize: '', downloads: 0, rating: 0, synopsis: '', requirements: [], instructions: [], warnings: [], changelog: [],
    checksum: '', cover: '/assets/patch-cover.svg', versions: [], updatedAt: today()
  };
  const error = applyFields(item, req.body, { isCreate: true });
  if (error) return res.status(422).json({ error });
  state.patches.push(item); log(req.session.user.id, 'CREATE', 'patch', item.id); res.status(201).json(item);
});

router.patch('/:id', requireAuth, requireMinimumRole('EDITOR'), (req, res) => {
  const item = findPatch(req.params.id); if (!item) return res.status(404).json({ error: 'Patch introuvable.' });
  const draft = { ...item }; // on ne modifie la fiche qu'une fois tous les champs validés
  const error = applyFields(draft, req.body);
  if (error) return res.status(422).json({ error });
  Object.assign(item, draft);
  log(req.session.user.id, 'UPDATE', 'patch', item.id); res.json(item);
});

router.delete('/:id', requireAuth, requireMinimumRole('ADMIN'), (req, res) => { const item = state.patches.find((p) => p.id === Number(req.params.id)); if (!item) return res.status(404).json({ error: 'Patch introuvable.' }); item.deletedAt = new Date().toISOString(); log(req.session.user.id, 'ARCHIVE', 'patch', item.id); res.status(204).end(); });

// Versions : la première entrée de `versions` est toujours la publication courante.
const syncCurrentRelease = (item) => { const release = item.versions[0]; item.currentVersion = release ? release.version : item.currentVersion; item.fileSize = release ? release.size : ''; item.checksum = release && release.checksum ? release.checksum : item.checksum; };

router.post('/:id/versions', requireAuth, requireMinimumRole('EDITOR'), (req, res) => {
  const item = findPatch(req.params.id); if (!item) return res.status(404).json({ error: 'Patch introuvable.' });
  const version = cleanText(req.body.version, 60); if (!version) return res.status(422).json({ error: 'Numéro de version requis.' });
  if (item.versions.some((entry) => entry.version === version)) return res.status(409).json({ error: 'Cette version existe déjà pour ce patch.' });
  const release = {
    id: nextId(allVersions()), version, size: cleanText(req.body.size, 40) || 'Inconnue',
    releasedAt: cleanDate(req.body.releasedAt) || today(), checksum: cleanText(req.body.checksum, 64),
    changelog: cleanList(req.body.changelog, 30), status: req.body.status === 'draft' ? 'draft' : 'active'
  };
  item.versions.unshift(release); syncCurrentRelease(item); item.updatedAt = today();
  if (release.changelog.length) item.changelog = release.changelog;
  log(req.session.user.id, 'CREATE', 'patch-version', release.id); res.status(201).json(release);
});

router.delete('/:id/versions/:versionId', requireAuth, requireMinimumRole('EDITOR'), (req, res) => {
  const item = findPatch(req.params.id); if (!item) return res.status(404).json({ error: 'Patch introuvable.' });
  const index = item.versions.findIndex((entry) => entry.id === Number(req.params.versionId));
  if (index === -1) return res.status(404).json({ error: 'Version introuvable.' });
  item.versions.splice(index, 1); syncCurrentRelease(item); item.updatedAt = today();
  log(req.session.user.id, 'DELETE', 'patch-version', Number(req.params.versionId)); res.status(204).end();
});

module.exports = router;
