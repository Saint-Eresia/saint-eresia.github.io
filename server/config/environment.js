const path = require('node:path');
require('dotenv').config();

const root = path.resolve(__dirname, '..', '..');
const nodeEnv = process.env.NODE_ENV || 'development';

if (nodeEnv === 'production' && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error('SESSION_SECRET doit contenir au moins 32 caractères en production.');
}
if (nodeEnv === 'production' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL est obligatoire en production.');
}

module.exports = Object.freeze({
  root,
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(process.env.PORT || 3000),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || '',
  sessionSecret: process.env.SESSION_SECRET || 'development-only-change-this-secret-now',
  trustProxy: Number(process.env.TRUST_PROXY || 0),
  uploadDir: path.resolve(root, process.env.UPLOAD_DIR || 'uploads'),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 50) * 1024 * 1024,
  storageDriver: process.env.STORAGE_DRIVER || 'local'
});
