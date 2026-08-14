const crypto = require('node:crypto');

const safe = new Set(['GET', 'HEAD', 'OPTIONS']);
const exempt = new Set(['/api/auth/login', '/api/auth/register', '/api/auth/forgot-password', '/api/auth/reset-password']);

function csrfProtection(req, res, next) {
  if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  if (safe.has(req.method) || exempt.has(req.path)) return next();
  const token = req.get('x-csrf-token');
  if (!token || token.length !== req.session.csrfToken.length || !crypto.timingSafeEqual(Buffer.from(token), Buffer.from(req.session.csrfToken))) {
    return res.status(403).json({ error: 'Jeton de sécurité invalide. Rechargez la page.' });
  }
  next();
}

module.exports = csrfProtection;
