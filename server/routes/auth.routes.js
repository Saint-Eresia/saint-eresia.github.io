const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const { state, publicUser, nextId, token } = require('../repositories/store');
const { authLimiter } = require('../middleware/rate-limit');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const failures = (req) => validationResult(req).array().map((e) => e.msg);

router.post('/register', authLimiter,
  body('email').isEmail().withMessage('Adresse e-mail invalide.').normalizeEmail(),
  body('username').isLength({ min: 3, max: 32 }).matches(/^[a-zA-Z0-9_-]+$/).withMessage('Nom utilisateur invalide.'),
  body('password').isStrongPassword({ minLength: 10, minSymbols: 1 }).withMessage('Le mot de passe doit contenir au moins 10 caractères, une majuscule, un chiffre et un symbole.'),
  async (req, res) => {
    const errors = failures(req); if (errors.length) return res.status(422).json({ errors });
    if (state.users.some((u) => u.email === req.body.email || u.username === req.body.username)) return res.status(409).json({ error: 'Ce compte existe déjà.' });
    const user = { id: nextId(state.users), email: req.body.email, username: req.body.username, name: req.body.username, role: 'USER', passwordHash: await bcrypt.hash(req.body.password, 12), verified: false };
    const verificationToken = token(); state.users.push(user); state.resetTokens.push({ token: verificationToken, userId: user.id, type: 'verification', expiresAt: Date.now() + 86_400_000 }); req.session.user = publicUser(user);
    res.status(201).json({ user: req.session.user, csrfToken: req.session.csrfToken, message: 'Compte créé. La vérification e-mail est simulée en développement.', ...(process.env.NODE_ENV !== 'production' ? { verificationUrl: `/api/auth/verify-email?token=${verificationToken}` } : {}) });
  });

router.post('/login', authLimiter, body('email').isEmail(), body('password').isString().notEmpty(), async (req, res) => {
  const user = state.users.find((u) => u.email.toLowerCase() === String(req.body.email).toLowerCase());
  if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) return res.status(401).json({ error: 'Identifiants incorrects.' });
  await new Promise((resolve, reject) => req.session.regenerate((e) => e ? reject(e) : resolve()));
  req.session.user = publicUser(user); req.session.csrfToken = token();
  res.json({ user: req.session.user, csrfToken: req.session.csrfToken });
});

router.post('/logout', requireAuth, (req, res, next) => req.session.destroy((error) => error ? next(error) : res.status(204).end()));
router.get('/me', (req, res) => res.json({ user: req.session.user || null, csrfToken: req.session.csrfToken }));
router.post('/forgot-password', authLimiter, body('email').isEmail(), (req, res) => {
  const user = state.users.find((u) => u.email === req.body.email);
  let resetUrl; if (user) { const resetToken = token(); state.resetTokens.push({ token: resetToken, userId: user.id, type: 'password', expiresAt: Date.now() + 3_600_000 }); resetUrl = `/reset-password.html?token=${resetToken}`; }
  res.json({ message: 'Si ce compte existe, une procédure de réinitialisation a été créée.', ...(process.env.NODE_ENV !== 'production' && resetUrl ? { resetUrl } : {}) });
});
router.post('/reset-password', authLimiter, body('token').isString(), body('password').isStrongPassword({ minLength: 10 }), async (req, res) => {
  const reset = state.resetTokens.find((t) => t.token === req.body.token && t.type === 'password' && t.expiresAt > Date.now());
  if (!reset) return res.status(400).json({ error: 'Lien invalide ou expiré.' });
  const user = state.users.find((u) => u.id === reset.userId); user.passwordHash = await bcrypt.hash(req.body.password, 12);
  state.resetTokens = state.resetTokens.filter((t) => t !== reset); res.json({ message: 'Mot de passe modifié.' });
});
router.get('/verify-email', (req, res) => {
  const verification = state.resetTokens.find((t) => t.token === req.query.token && t.type === 'verification' && t.expiresAt > Date.now());
  if (!verification) return res.status(400).json({ error: 'Lien de vérification invalide ou expiré.' });
  const user = state.users.find((u) => u.id === verification.userId); user.verified = true; state.resetTokens = state.resetTokens.filter((t) => t !== verification);
  res.json({ message: 'Adresse e-mail vérifiée.' });
});

module.exports = router;
