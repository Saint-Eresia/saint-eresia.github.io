const ranks = { USER: 0, TRANSLATOR: 1, EDITOR: 2, MODERATOR: 3, ADMIN: 4 };

function requireRole(...allowed) {
  return (req, res, next) => {
    const role = req.session?.user?.role;
    if (!role || !allowed.includes(role)) return res.status(403).json({ error: 'Autorisation insuffisante.' });
    next();
  };
}

function requireMinimumRole(minimum) {
  return (req, res, next) => {
    const role = req.session?.user?.role;
    if (!role || ranks[role] < ranks[minimum]) return res.status(403).json({ error: 'Autorisation insuffisante.' });
    next();
  };
}

module.exports = { requireRole, requireMinimumRole, ranks };
