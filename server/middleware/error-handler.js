function notFound(req, res) {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Ressource introuvable.' });
  res.status(404).sendFile('404.html', { root: res.app.locals.publicDir });
}

function errorHandler(error, req, res, _next) {
  const status = error.status || (error.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (process.env.NODE_ENV !== 'test') console.error(`[${new Date().toISOString()}]`, error);
  res.status(status).json({ error: status === 500 ? 'Une erreur interne est survenue.' : error.message });
}

module.exports = { notFound, errorHandler };
