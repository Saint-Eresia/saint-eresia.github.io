const express = require('express');
const { state, publicUser } = require('../repositories/store');
const { requireAuth } = require('../middleware/auth');
const { requireMinimumRole } = require('../middleware/roles');

const router = express.Router();
router.use(requireAuth, requireMinimumRole('MODERATOR'));
router.get('/dashboard', (_req, res) => res.json({ novels: state.novels.filter((n) => !n.deletedAt).length, chapters: state.novels.flatMap((n) => n.volumes.flatMap((v) => v.chapters)).length, patches: state.patches.filter((p) => !p.deletedAt).length, users: state.users.length, downloads: state.downloads.length, recentAudit: state.auditLogs.slice(-10).reverse() }));
router.get('/users', (_req, res) => res.json(state.users.map(publicUser)));
router.patch('/users/:id/role', requireMinimumRole('ADMIN'), (req, res) => { const user = state.users.find((u) => u.id === Number(req.params.id)); if (!user) return res.status(404).json({ error: 'Utilisateur introuvable.' }); const roles = ['USER','TRANSLATOR','EDITOR','MODERATOR','ADMIN']; if (!roles.includes(req.body.role)) return res.status(422).json({ error: 'Rôle invalide.' }); user.role = req.body.role; res.json(publicUser(user)); });
router.get('/audit', (_req, res) => res.json(state.auditLogs.slice().reverse()));
module.exports = router;
