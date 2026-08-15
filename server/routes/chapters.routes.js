const express = require('express');
const { state, nextId, log } = require('../repositories/store');
const { requireAuth } = require('../middleware/auth');
const { requireMinimumRole } = require('../middleware/roles');
const { cleanText, cleanChapterHtml, slugify } = require('../utils/validation');

const router = express.Router();
const allChapters = () => state.novels.flatMap((novel) => novel.volumes.flatMap((volume) => volume.chapters.map((chapter) => ({ novel, volume, chapter }))));

router.get('/:slug', (req, res) => {
  const found = allChapters().find(({ chapter }) => chapter.slug === req.params.slug);
  if (!found) return res.status(404).json({ error: 'Chapitre introuvable.' });
  if (found.chapter.status === 'Programmé' && new Date(found.chapter.scheduledAt) > new Date() && !req.session?.user) return res.status(404).json({ error: 'Chapitre introuvable.' });
  res.json({ ...found.chapter, novel: { id: found.novel.id, slug: found.novel.slug, title: found.novel.title, readingUnit: found.novel.readingUnit || `chapter`, team: found.novel.translator }, volume: { id: found.volume.id, number: found.volume.number, title: found.volume.title }, navigation: allChapters().filter((x) => x.novel.id === found.novel.id).map((x) => ({ slug: x.chapter.slug, number: x.chapter.number, title: x.chapter.title })) });
});

router.patch('/:id', requireAuth, requireMinimumRole('TRANSLATOR'), (req, res) => {
  const found = allChapters().find(({ chapter }) => chapter.id === Number(req.params.id)); if (!found) return res.status(404).json({ error: 'Chapitre introuvable.' });
  if (req.body.title !== undefined) found.chapter.title = cleanText(req.body.title, 180);
  if (req.body.content !== undefined) found.chapter.content = cleanChapterHtml(req.body.content);
  if (req.body.status !== undefined) found.chapter.status = cleanText(req.body.status, 30);
  found.chapter.wordCount = found.chapter.content.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  found.chapter.readingTime = Math.max(1, Math.ceil(found.chapter.wordCount / 220));
  log(req.session.user.id, 'UPDATE', 'chapter', found.chapter.id); res.json(found.chapter);
});
router.delete('/:id', requireAuth, requireMinimumRole('EDITOR'), (req, res) => {
  const found = allChapters().find(({ chapter }) => chapter.id === Number(req.params.id)); if (!found) return res.status(404).json({ error: 'Chapitre introuvable.' });
  found.volume.chapters = found.volume.chapters.filter((c) => c.id !== found.chapter.id); log(req.session.user.id, 'DELETE', 'chapter', found.chapter.id); res.status(204).end();
});
router.post('/:id/publish', requireAuth, requireMinimumRole('EDITOR'), (req, res) => {
  const found = allChapters().find(({ chapter }) => chapter.id === Number(req.params.id)); if (!found) return res.status(404).json({ error: 'Chapitre introuvable.' });
  found.chapter.status = req.body.scheduledAt ? 'Programmé' : 'Publié'; found.chapter.scheduledAt = req.body.scheduledAt || null; log(req.session.user.id, 'PUBLISH', 'chapter', found.chapter.id); res.json(found.chapter);
});

module.exports = { router, allChapters, createChapter(req, res) {
  const volume = state.novels.flatMap((n) => n.volumes).find((v) => v.id === Number(req.params.volumeId)); if (!volume) return res.status(404).json({ error: 'Volume introuvable.' });
  const chapter = { id: Math.max(0, ...allChapters().map((x) => x.chapter.id)) + 1, number: Number(req.body.number) || volume.chapters.length + 1, title: cleanText(req.body.title, 180), slug: slugify(req.body.slug || req.body.title), content: cleanChapterHtml(req.body.content), status: 'Brouillon', readingTime: 1, wordCount: 0 };
  volume.chapters.push(chapter); log(req.session.user.id, 'CREATE', 'chapter', chapter.id); res.status(201).json(chapter);
}};
