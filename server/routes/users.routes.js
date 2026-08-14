const express = require('express');
const { state, nextId } = require('../repositories/store');
const { requireAuth } = require('../middleware/auth');
const { cleanText } = require('../utils/validation');

const router = express.Router();
router.use(requireAuth);

router.get('/me/favorites', (req, res) => {
  const links = state.favorites.filter((f) => f.userId === req.session.user.id);
  res.json({ novels: links.filter((f) => f.itemType === 'novel').map((f) => { const item=state.novels.find((n) => n.id === f.itemId); return item ? { ...item, favoriteId:f.id } : null; }).filter(Boolean), patches: links.filter((f) => f.itemType === 'patch').map((f) => { const item=state.patches.find((p) => p.id === f.itemId); return item ? { ...item, favoriteId:f.id } : null; }).filter(Boolean) });
});
router.post('/me/favorites', (req, res) => {
  const type = req.body.itemType; if (!['novel','patch'].includes(type)) return res.status(422).json({ error: 'Type invalide.' });
  const itemId = Number(req.body.itemId); let favorite = state.favorites.find((f) => f.userId === req.session.user.id && f.itemType === type && f.itemId === itemId);
  if (!favorite) { favorite = { id: nextId(state.favorites), userId: req.session.user.id, itemType: type, itemId }; state.favorites.push(favorite); }
  res.status(201).json(favorite);
});
router.delete('/me/favorites/:id', (req, res) => { const index = state.favorites.findIndex((f) => f.id === Number(req.params.id) && f.userId === req.session.user.id); if (index < 0) return res.status(404).json({ error: 'Favori introuvable.' }); state.favorites.splice(index, 1); res.status(204).end(); });
router.get('/me/history', (req, res) => res.json(state.history.filter((h) => h.userId === req.session.user.id).sort((a,b) => b.viewedAt.localeCompare(a.viewedAt))));
router.post('/me/history', (req, res) => { const entry = { id: nextId(state.history), userId: req.session.user.id, itemType: cleanText(req.body.itemType, 20), itemId: Number(req.body.itemId), chapterId: Number(req.body.chapterId) || null, viewedAt: new Date().toISOString() }; state.history.push(entry); res.status(201).json(entry); });
router.delete('/me/history/:id', (req, res) => { state.history = state.history.filter((h) => !(h.userId === req.session.user.id && (req.params.id === 'all' || h.id === Number(req.params.id)))); res.status(204).end(); });
router.get('/me/reading-progress', (req, res) => res.json(state.progress.filter((p) => p.userId === req.session.user.id)));
router.put('/me/reading-progress', (req, res) => { let progress = state.progress.find((p) => p.userId === req.session.user.id && p.novelId === Number(req.body.novelId)); if (!progress) { progress = { userId: req.session.user.id, novelId: Number(req.body.novelId) }; state.progress.push(progress); } progress.chapterId = Number(req.body.chapterId); progress.percent = Math.min(100, Math.max(0, Number(req.body.percent) || 0)); progress.position = Math.max(0, Number(req.body.position) || 0); progress.updatedAt = new Date().toISOString(); res.json(progress); });
router.get('/me/reading-list', (req, res) => res.json(state.readingList.filter((r) => r.userId === req.session.user.id).map((r) => ({ ...r, novel: state.novels.find((n) => n.id === r.novelId) }))));
router.put('/me/reading-list', (req, res) => { let entry = state.readingList.find((r) => r.userId === req.session.user.id && r.novelId === Number(req.body.novelId)); if (!entry) { entry = { id: nextId(state.readingList), userId: req.session.user.id, novelId: Number(req.body.novelId) }; state.readingList.push(entry); } entry.category = cleanText(req.body.category, 30); res.json(entry); });
router.patch('/me/profile', (req, res) => { const user = state.users.find((u) => u.id === req.session.user.id); user.name = cleanText(req.body.name, 80); user.bio = cleanText(req.body.bio, 500); req.session.user.name = user.name; req.session.user.bio = user.bio; res.json(req.session.user); });

module.exports = router;
