const path = require('node:path');
const crypto = require('node:crypto');
const fs = require('node:fs');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const env = require('../config/environment');
const storageService = require('../services/storage.service');
const { requireAuth } = require('../middleware/auth');
const { requireMinimumRole } = require('../middleware/roles');

fs.mkdirSync(env.uploadDir, { recursive: true });
const imageMimes = new Set(['image/jpeg','image/png','image/webp','image/avif']);
const patchMimes = new Set(['application/zip','application/x-7z-compressed','application/octet-stream']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: env.maxUploadBytes, files: 1 } });
const router = express.Router();
router.use(requireAuth, requireMinimumRole('EDITOR'));
router.post('/image', upload.single('file'), async (req, res) => {
  if (!req.file || !imageMimes.has(req.file.mimetype)) return res.status(415).json({ error: 'Image non autorisée.' });
  const optimized = await sharp(req.file.buffer).rotate().resize({ width: 1800, height: 1800, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  const stored = await storageService.put(optimized, '.webp', 'images', 'image/webp');
  res.status(201).json({ url: stored.url, storageKey: stored.key });
});
router.post('/patch', upload.single('file'), async (req, res) => {
  if (req.body.rightsConfirmed !== 'true') return res.status(422).json({ error: 'La confirmation des droits est obligatoire.' });
  if (!req.file || !patchMimes.has(req.file.mimetype) || !/\.(zip|7z)$/i.test(req.file.originalname)) return res.status(415).json({ error: 'Archive ZIP ou 7Z requise.' });
  const extension = path.extname(req.file.originalname).toLowerCase();
  const stored = await storageService.put(req.file.buffer, extension, 'patches', req.file.mimetype);
  res.status(201).json({ fileId: stored.key, checksum: crypto.createHash('sha256').update(req.file.buffer).digest('hex'), size: req.file.size });
});
module.exports = router;
