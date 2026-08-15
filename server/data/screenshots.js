// Recense les captures déposées dans public/assets/screenshots/<slug>/.
// Module isolé, comme content-merge : le serveur et le build statique l'utilisent tous les deux,
// sans que le build ait à charger les comptes ni bcrypt.
const fs = require('node:fs');
const path = require('node:path');

const SHOTS_ROOT = path.join(__dirname, '..', '..', 'public', 'assets', 'screenshots');
const IMAGE = /\.(webp|png|jpe?g|avif|gif)$/i;

// Toute image déposée dans public/assets/screenshots/<slug>/ est reprise automatiquement.
function scanScreenshots(patches) {
  for (const patch of patches) {
    const dir = path.join(SHOTS_ROOT, patch.slug);
    let files = [];
    try { files = fs.readdirSync(dir).filter((name) => IMAGE.test(name)).sort(); } catch { files = []; }
    patch.screenshots = files.map((name) => `/assets/screenshots/${patch.slug}/${name}`);
  }
  return patches;
}

module.exports = { scanScreenshots, SHOTS_ROOT, IMAGE };
