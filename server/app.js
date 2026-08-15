const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const env = require('./config/environment');
const { pool } = require('./config/database');
const csrfProtection = require('./middleware/csrf');
const { apiLimiter } = require('./middleware/rate-limit');
const { requireAuth } = require('./middleware/auth');
const { requireMinimumRole } = require('./middleware/roles');
const { notFound, errorHandler } = require('./middleware/error-handler');
const { state, nextId, log } = require('./repositories/store');
const volumes = require('./routes/volumes.routes');
const chapters = require('./routes/chapters.routes');

const app = express();
const publicDir = path.join(env.root, 'public');
app.locals.publicDir = publicDir;
if (env.trustProxy) app.set('trust proxy', env.trustProxy);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:'], fontSrc: ["'self'"], connectSrc: ["'self'"], objectSrc: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"] } }, crossOriginResourcePolicy: { policy: 'same-origin' } }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

const sessionOptions = {
  name: 'se.sid', secret: env.sessionSecret, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, secure: env.isProduction, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 }
};
if (pool) sessionOptions.store = new pgSession({ pool, tableName: 'sessions', createTableIfMissing: true });
app.use(session(sessionOptions));
app.use(csrfProtection);
app.use('/api', apiLimiter);

app.get('/api/health', async (_req, res) => {
  let database = 'demo-memory';
  if (pool) { try { await pool.query('SELECT 1'); database = 'postgresql'; } catch { database = 'unavailable'; } }
  res.json({ status: database === 'unavailable' ? 'degraded' : 'ok', service: 'Saint Eresia', database });
});
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/novels', require('./routes/novels.routes'));
app.use('/api/chapters', chapters.router);
app.use('/api/patches', require('./routes/patches.routes'));
app.use('/api/users', require('./routes/users.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/uploads', require('./routes/uploads.routes'));

app.get('/api/novels/:novelId/volumes', volumes.list);
app.post('/api/novels/:novelId/volumes', requireAuth, requireMinimumRole('EDITOR'), volumes.create);
app.patch('/api/volumes/:id', requireAuth, requireMinimumRole('EDITOR'), volumes.update);
app.delete('/api/volumes/:id', requireAuth, requireMinimumRole('ADMIN'), volumes.remove);
app.post('/api/volumes/:volumeId/chapters', requireAuth, requireMinimumRole('TRANSLATOR'), chapters.createChapter);

app.post('/api/patches/:patchId/versions', requireAuth, requireMinimumRole('EDITOR'), (req, res) => {
  const patch = state.patches.find((p) => p.id === Number(req.params.patchId)); if (!patch) return res.status(404).json({ error: 'Patch introuvable.' });
  if (req.body.rightsConfirmed !== true) return res.status(422).json({ error: 'La confirmation des droits est obligatoire.' });
  const version = { id: Math.max(0, ...state.patches.flatMap((p) => p.versions.map((v) => v.id))) + 1, version: String(req.body.version || ''), size: String(req.body.size || ''), releasedAt: new Date().toISOString().slice(0,10), checksum: String(req.body.checksum || ''), status: 'active' };
  patch.versions.push(version); patch.currentVersion = version.version; log(req.session.user.id, 'CREATE', 'patch_version', version.id); res.status(201).json(version);
});
app.patch('/api/patch-versions/:id', requireAuth, requireMinimumRole('EDITOR'), (req, res) => { const version = state.patches.flatMap((p) => p.versions).find((v) => v.id === Number(req.params.id)); if (!version) return res.status(404).json({ error: 'Version introuvable.' }); Object.assign(version, { status: String(req.body.status || version.status) }); res.json(version); });
app.delete('/api/patch-versions/:id', requireAuth, requireMinimumRole('ADMIN'), (req, res) => { for (const patch of state.patches) patch.versions = patch.versions.filter((v) => v.id !== Number(req.params.id)); res.status(204).end(); });
app.post('/api/patch-versions/:id/download', (req, res) => { const patch = state.patches.find((p) => p.versions.some((v) => v.id === Number(req.params.id))); if (!patch) return res.status(404).json({ error: 'Fichier introuvable.' }); const version = patch.versions.find((v) => v.id === Number(req.params.id)); patch.downloads += 1; state.downloads.push({ id: nextId(state.downloads), userId: req.session.user?.id || null, patchId: patch.id, versionId: version.id, downloadedAt: new Date().toISOString() }); res.json({ message: 'Téléchargement de démonstration confirmé.', checksum: version.checksum || patch.checksum, url: null }); });

app.use('/uploads', express.static(env.uploadDir, { fallthrough: false, dotfiles: 'deny', maxAge: env.isProduction ? '1h' : 0 }));
app.use(express.static(publicDir, { extensions: ['html'], maxAge: env.isProduction ? '1h' : 0, setHeaders(res, file) { if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
app.use(notFound);
app.use(errorHandler);

// Surveillance de content/ et des captures : tout ajout ou modification est repris sans redémarrer.
function watchContent() {
  const { reloadContent } = require('./repositories/store');
  const importer = require('./database/import-content');
  const targets = [
    path.join(__dirname, '..', 'content'),
    path.join(__dirname, '..', 'public', 'assets', 'screenshots')
  ];
  let timer = null;
  const refresh = () => {
    clearTimeout(timer); // on attend la fin des écritures avant de relire
    timer = setTimeout(() => {
      try {
        importer.run();
        const counts = reloadContent();
        console.log(`Contenu rechargé : ${counts.novels} roman(s), ${counts.patches} patch(s).`);
      } catch (error) {
        console.error(`Rechargement impossible : ${error.message}`);
      }
    }, 300);
  };
  for (const dir of targets) {
    try { fs.watch(dir, { recursive: true }, refresh); }
    catch { /* dossier absent ou surveillance non supportée : on l'ignore */ }
  }
  console.log('Surveillance de content/ active : déposez un .md, le site se met à jour seul.');
}

if (require.main === module) {
  const server = app.listen(env.port, () => console.log(`Saint Eresia disponible sur ${env.appUrl}`));
  if (env.nodeEnv !== 'production') watchContent();
  const shutdown = () => server.close(() => { if (pool) pool.end(); process.exit(0); });
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
}

module.exports = app;
