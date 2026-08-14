const fs = require('node:fs/promises');
const path = require('node:path');
const { pool } = require('../config/database');

async function run() {
  if (!pool) throw new Error('DATABASE_URL est obligatoire pour exécuter les migrations.');
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const dir = path.join(__dirname, 'migrations');
  for (const name of (await fs.readdir(dir)).filter((x) => x.endsWith('.sql')).sort()) {
    const exists = await pool.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name]);
    if (exists.rowCount) continue;
    const sql = await fs.readFile(path.join(dir, name), 'utf8');
    await pool.query(sql); await pool.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
    console.log(`Migration appliquée : ${name}`);
  }
  await pool.end();
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
