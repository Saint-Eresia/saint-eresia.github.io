const express = require('express');
const { state, nextId, log } = require('../repositories/store');
const { requireAuth } = require('../middleware/auth');
const { requireMinimumRole } = require('../middleware/roles');
const { cleanText, slugify } = require('../utils/validation');

const router = express.Router();

router.get('/', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(24, Math.max(1, Number(req.query.limit) || 8));
  const search = String(req.query.search || '').toLowerCase();
  let items = state.novels.filter((n) => !n.deletedAt);
  if (search) items = items.filter((n) => [n.title, n.author, ...n.genres, ...n.tags].join(' ').toLowerCase().includes(search));
  if (req.query.type) items = items.filter((n) => n.type === req.query.type);
  if (req.query.genre) items = items.filter((n) => n.genres.includes(req.query.genre));
  if (req.query.status) items = items.filter((n) => n.workStatus === req.query.status);
  if (req.query.translationStatus) items = items.filter((n) => n.translationStatus === req.query.translationStatus);
  if (req.query.language) items = items.filter((n) => n.originalLanguage === req.query.language);
  if (req.query.author) items = items.filter((n) => n.author.toLowerCase().includes(String(req.query.author).toLowerCase()));
  if (req.query.year) items = items.filter((n) => n.publishedAt.startsWith(String(req.query.year)));
  if (req.query.rating) items = items.filter((n) => n.rating >= Number(req.query.rating));
  const sorters = { popular: (a,b) => b.views-a.views, rating: (a,b) => b.rating-a.rating, followed: (a,b) => b.favorites-a.favorites, alpha: (a,b) => a.title.localeCompare(b.title), published: (a,b) => b.publishedAt.localeCompare(a.publishedAt), updated: (a,b) => b.updatedAt.localeCompare(a.updatedAt) };
  items.sort(sorters[req.query.sort] || sorters.updated);
  const total = items.length;
  res.json({ items: items.slice((page - 1) * limit, page * limit), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

router.get('/:slug', (req, res) => {
  const item = state.novels.find((n) => n.slug === req.params.slug && !n.deletedAt);
  if (!item) return res.status(404).json({ error: 'Novel introuvable.' });
  item.views += 1; res.json(item);
});

router.post('/', requireAuth, requireMinimumRole('EDITOR'), (req, res) => {
  const title = cleanText(req.body.title, 160); if (!title) return res.status(422).json({ error: 'Titre requis.' });
  const item = { id: nextId(state.novels), title, slug: slugify(req.body.slug || title), type: req.body.type === 'Web Novel' ? 'Web Novel' : 'Light Novel', author: cleanText(req.body.author, 120), synopsis: cleanText(req.body.synopsis, 4000), genres: [], tags: [], volumes: [], views: 0, favorites: 0, rating: 0, updatedAt: new Date().toISOString().slice(0,10) };
  state.novels.push(item); log(req.session.user.id, 'CREATE', 'novel', item.id); res.status(201).json(item);
});
router.patch('/:id', requireAuth, requireMinimumRole('EDITOR'), (req, res) => {
  const item = state.novels.find((n) => n.id === Number(req.params.id)); if (!item) return res.status(404).json({ error: 'Novel introuvable.' });
  ['title','author','synopsis','workStatus','translationStatus'].forEach((key) => { if (req.body[key] !== undefined) item[key] = cleanText(req.body[key], key === 'synopsis' ? 4000 : 160); });
  item.updatedAt = new Date().toISOString().slice(0,10); log(req.session.user.id, 'UPDATE', 'novel', item.id); res.json(item);
});
router.delete('/:id', requireAuth, requireMinimumRole('ADMIN'), (req, res) => {
  const item = state.novels.find((n) => n.id === Number(req.params.id)); if (!item) return res.status(404).json({ error: 'Novel introuvable.' });
  item.deletedAt = new Date().toISOString(); log(req.session.user.id, 'ARCHIVE', 'novel', item.id); res.status(204).end();
});

module.exports = router;
