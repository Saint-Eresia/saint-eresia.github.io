// Fusionne le texte importé depuis content/ par-dessus l'ossature des romans.
// Module isolé : le build statique s'en sert sans charger les comptes ni bcrypt.

function applyImportedContent(novels) {
  let imported;
  try { imported = require('../data/content.json'); } catch { return novels; }
  if (!imported || !Array.isArray(imported.sections)) return novels;
  let applied = 0, unknown = 0;
  for (const section of imported.sections) {
    const novel = novels.find((n) => n.slug === section.novelSlug);
    if (!novel) { unknown += 1; continue; }
    let volume = novel.volumes.find((v) => v.number === section.volume);
    if (!volume) {
      volume = { id: novel.id * 100 + section.volume, number: section.volume, title: '', slug: `${novel.slug}-volume-${section.volume}`, summary: '', chapters: [] };
      novel.volumes.push(volume);
      novel.volumes.sort((a, b) => a.number - b.number);
    }
    let chapter = volume.chapters.find((c) => c.slug === section.slug);
    if (!chapter) {
      chapter = { id: novel.id * 1000 + section.volume * 10 + section.number, number: section.number, slug: section.slug, title: '' };
      volume.chapters.push(chapter);
      volume.chapters.sort((a, b) => a.number - b.number);
    }
    Object.assign(chapter, {
      title: section.title, status: section.status, publishedAt: section.publishedAt,
      wordCount: section.wordCount, readingTime: section.readingTime,
      translator: section.translator || novel.translator, content: section.content
    });
    applied += 1;
  }
  for (const novel of novels) {
    novel.volumeCount = novel.volumes.length;
    novel.chapterCount = novel.volumes.reduce((total, volume) => total + volume.chapters.length, 0);
  }
  if (applied) console.log(`content/ : ${applied} section(s) chargée(s)${unknown ? `, ${unknown} ignorée(s) (roman inconnu)` : ''}`);
  return novels;
}

module.exports = { applyImportedContent };
