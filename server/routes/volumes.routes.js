const { state, nextId, log } = require('../repositories/store');
const { cleanText, slugify } = require('../utils/validation');

const handlers = {
  list(req, res) { const novel = state.novels.find((n) => n.id === Number(req.params.novelId)); if (!novel) return res.status(404).json({ error: 'Novel introuvable.' }); res.json(novel.volumes); },
  create(req, res) { const novel = state.novels.find((n) => n.id === Number(req.params.novelId)); if (!novel) return res.status(404).json({ error: 'Novel introuvable.' }); const volume = { id: Math.max(0, ...state.novels.flatMap((n) => n.volumes.map((v) => v.id))) + 1, number: Number(req.body.number) || novel.volumes.length + 1, title: cleanText(req.body.title, 160), slug: slugify(req.body.slug || req.body.title), summary: cleanText(req.body.summary, 1000), chapters: [] }; novel.volumes.push(volume); log(req.session.user.id, 'CREATE', 'volume', volume.id); res.status(201).json(volume); },
  update(req, res) { const volume = state.novels.flatMap((n) => n.volumes).find((v) => v.id === Number(req.params.id)); if (!volume) return res.status(404).json({ error: 'Volume introuvable.' }); if (req.body.title) volume.title = cleanText(req.body.title, 160); if (req.body.summary) volume.summary = cleanText(req.body.summary, 1000); res.json(volume); },
  remove(req, res) { const novel = state.novels.find((n) => n.volumes.some((v) => v.id === Number(req.params.id))); if (!novel) return res.status(404).json({ error: 'Volume introuvable.' }); novel.volumes = novel.volumes.filter((v) => v.id !== Number(req.params.id)); res.status(204).end(); }
};
module.exports = handlers;
