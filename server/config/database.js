const { Pool } = require('pg');
const env = require('./environment');

let pool = null;
if (env.databaseUrl) {
  pool = new Pool({
    connectionString: env.databaseUrl,
    ssl: env.isProduction ? { rejectUnauthorized: true } : false,
    max: 10,
    idleTimeoutMillis: 30_000
  });
}

async function query(text, params = []) {
  if (!pool) throw Object.assign(new Error('PostgreSQL non configuré'), { code: 'DB_NOT_CONFIGURED' });
  return pool.query(text, params);
}

module.exports = { pool, query };
