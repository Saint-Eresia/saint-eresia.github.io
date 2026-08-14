const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { novels, patches } = require('../data/demo-data');

// Le texte traduit vit dans content/ (versionné) ; l'import le dépose ici et il recouvre l'ossature.
function applyImportedContent(novels) {
  let imported;
  try { imported = require('../data/content.json'); } catch { return novels; }
  if (!imported || !Array.isArray(imported.sections)) return novels;
  let applied = 0, unknown = 0;
  for (const section of imported.sections) {
    const novel = novels.find((n) => n.slug === section.novelSlug);
    if (!novel) { unknown += 1; continue; }
    let volume = novel.volumes.find((v) => v.number === section.volume);
    if (!volume) {
      volume = { id: novel.id * 100 + section.volume, number: section.volume, title: '', slug: `${novel.slug}-volume-${section.volume}`, summary: '', chapters: [] };
      novel.volumes.push(volume);
      novel.volumes.sort((a, b) => a.number - b.number);
    }
    let chapter = volume.chapters.find((c) => c.slug === section.slug);
    if (!chapter) {
      chapter = { id: novel.id * 1000 + section.volume * 10 + section.number, number: section.number, slug: section.slug, title: '' };
      volume.chapters.push(chapter);
      volume.chapters.sort((a, b) => a.number - b.number);
    }
    Object.assign(chapter, {
      title: section.title, status: section.status, publishedAt: section.publishedAt,
      wordCount: section.wordCount, readingTime: section.readingTime,
      translator: section.translator || novel.translator, content: section.content
    });
    applied += 1;
  }
  for (const novel of novels) {
    novel.volumeCount = novel.volumes.length;
    novel.chapterCount = novel.volumes.reduce((total, volume) => total + volume.chapters.length, 0);
  }
  if (applied) console.log(`content/ : ${applied} section(s) chargée(s)${unknown ? `, ${unknown} ignorée(s) (roman inconnu)` : ''}`);
  return novels;
}

const users = [
  { id: 1, email: 'admin@saint-eresia.local', username: 'eresia-admin', name: 'Admin Eresia', role: 'ADMIN', passwordHash: bcrypt.hashSync('AdminEresia!2026', 10), verified: true },
  { id: 2, email: 'lecteur@saint-eresia.local', username: 'lecteur-demo', name: 'Lecteur Démo', role: 'USER', passwordHash: bcrypt.hashSync('LecteurEresia!2026', 10), verified: true }
];

const state = {
  novels: applyImportedContent(structuredClone(novels)), patches: structuredClone(patches), users,
  favorites: [{ id: 1, userId: 2, itemType: 'novel', itemId: 1 }, { id: 2, userId: 2, itemType: 'patch', itemId: 1 }],
  readingList: [{ id: 1, userId: 2, novelId: 1, category: 'En cours' }],
  progress: [{ userId: 2, novelId: 1, chapterId: 11, percent: 42, position: 1100, updatedAt: new Date().toISOString() }],
  history: [], downloads: [], auditLogs: [], resetTokens: []
};

const publicUser = ({ passwordHash, ...user }) => user;
const nextId = (items) => Math.max(0, ...items.map((item) => Number(item.id) || 0)) + 1;
const log = (userId, action, entity, entityId) => state.auditLogs.push({ id: nextId(state.auditLogs), userId, action, entity, entityId, createdAt: new Date().toISOString() });
const token = () => crypto.randomBytes(32).toString('hex');

module.exports = { state, publicUser, nextId, log, token };
