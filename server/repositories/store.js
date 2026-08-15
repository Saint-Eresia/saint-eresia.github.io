const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { novels, patches } = require('../data/demo-data');
const { applyImportedContent } = require('../data/content-merge');

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

// Recharge à chaud : reconstruit les romans depuis content/ et rescanne les captures des patchs.
const { scanScreenshots } = require('../data/screenshots');

function reloadContent() {
  const { novels } = require('../data/demo-data');
  state.novels = applyImportedContent(structuredClone(novels));
  scanScreenshots(state.patches);
  return { novels: state.novels.length, patches: state.patches.length };
}
scanScreenshots(state.patches); // premier scan au démarrage

module.exports = { state, publicUser, nextId, log, token, reloadContent, scanScreenshots };
