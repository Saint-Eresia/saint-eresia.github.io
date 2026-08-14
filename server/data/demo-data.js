// Contenus réels de l'équipe. Les chapitres non publiés portent un texte d'attente :
// aucun extrait des œuvres originales n'est stocké ici.
const pending = '<p>Ce chapitre n’est pas encore publié. La traduction est en cours.</p>';

const novelSpecs = [
  {
    slug: 'rakudai-kishi-no-cavalry', title: 'Rakudai Kishi no Cavalry', cover: '/assets/LN/rakudai.webp',
    originalTitle: '落第騎士の英雄譚', alternativeTitles: ['A Tale of Worst One', 'Chivalry of a Failed Knight'],
    author: 'Riku Misora', artist: 'Won', sourceLanguage: 'Anglais', translator: 'Saint Eresia', genres: ['Action', 'Fantasy', 'École'], tags: ['Combat', 'Romance'],
    workStatus: 'Terminé', translationStatus: 'En cours', publishedAt: '2013-07-01', readingUnit: 'volume', volumeCount: 19,
    synopsis: 'Light novel de Riku Misora illustré par Won, publié chez SB Creative (GA Bunko). Récit d’action situé dans une académie de chevaliers-mages.'
  },
  {
    slug: 'zero-no-tsukaima', title: 'Zero no Tsukaima', cover: '/assets/LN/zeronotsukaima.webp',
    originalTitle: 'ゼロの使い魔', alternativeTitles: ['The Familiar of Zero', 'La Familière de Zéro'],
    author: 'Noboru Yamaguchi', artist: 'Eiji Usatsuka', translator: 'Saint Eresia', genres: ['Fantasy', 'Comédie', 'Romance'], tags: ['Isekai', 'Magie'],
    workStatus: 'Terminé', translationStatus: 'En cours', publishedAt: '2004-06-01', readingUnit: 'volume', volumeCount: 22,
    synopsis: 'Light novel de Noboru Yamaguchi illustré par Eiji Usatsuka, publié chez Media Factory (MF Bunko J). Comédie fantastique autour d’une apprentie mage et de son familier.'
  },
  {
    slug: 'la-melancolie-de-haruhi-suzumiya', title: 'La Mélancolie d’Haruhi Suzumiya', cover: '/assets/LN/suzumiya.webp',
    originalTitle: '涼宮ハルヒの憂鬱', alternativeTitles: ['Suzumiya Haruhi no Yūutsu', 'The Melancholy of Haruhi Suzumiya'],
    author: 'Nagaru Tanigawa', artist: 'Noizi Ito', translator: 'Baka-tsuki', genres: ['Science-fiction', 'Comédie', 'École'], tags: ['Surnaturel', 'Club scolaire'],
    workStatus: 'En cours', translationStatus: 'Reprise en cours', publishedAt: '2003-06-06', readingUnit: 'chapter', volumeCount: 12, chaptersPerVolume: 6,
    translationNote: 'Les chapitres déjà disponibles proviennent de la traduction de Baka-tsuki, aujourd’hui abandonnée. Saint Eresia reprend la suite.',
    synopsis: 'Light novel de Nagaru Tanigawa illustré par Noizi Ito, publié chez Kadokawa (Sneaker Bunko). Premier tome de la série Haruhi Suzumiya.'
  }
];

// Deux granularités de publication : 'volume' (le tome entier se lit d'un bloc) ou 'chapter'.
// Dans les deux cas l'unité lisible est une entrée de `chapters` — c'est ce que sert /api/chapters/:slug.
const novels = novelSpecs.map((spec, index) => {
  const unit = spec.readingUnit || 'chapter';
  const volumes = Array.from({ length: spec.volumeCount || 2 }, (_, v) => {
    const number = v + 1;
    const sections = unit === 'volume'
      ? [{ number: 1, slug: `${spec.slug}-tome-${number}`, title: '' }]
      : Array.from({ length: spec.chaptersPerVolume || 3 }, (_, c) => ({
          number: c + 1, slug: `${spec.slug}-v${number}-ch${c + 1}`, title: ''
        }));
    return {
      id: index * 100 + number,
      number,
      title: '',
      slug: `${spec.slug}-volume-${number}`,
      summary: '',
      chapters: sections.map((section) => ({
        id: index * 1000 + number * 10 + section.number,
        number: section.number,
        slug: section.slug,
        title: section.title,
        status: 'Brouillon',
        publishedAt: null,
        wordCount: 0,
        readingTime: 0,
        translator: spec.translator,
        content: pending
      }))
    };
  });
  const chapterCount = volumes.reduce((total, volume) => total + volume.chapters.length, 0);
  return {
    id: index + 1, slug: spec.slug, title: spec.title, originalTitle: spec.originalTitle,
    alternativeTitles: spec.alternativeTitles, type: 'Light Novel', author: spec.author,
    artist: spec.artist, translator: spec.translator, readingUnit: unit,
    originalLanguage: spec.sourceLanguage || 'Japonais', translationLanguage: 'Français',
    genres: spec.genres, tags: spec.tags,
    workStatus: spec.workStatus, translationStatus: spec.translationStatus,
    translationNote: spec.translationNote || '',
    synopsis: spec.synopsis,
    publishedAt: spec.publishedAt, updatedAt: '2026-08-14',
    rating: 0, ratingsCount: 0, views: 0, favorites: 0, warnings: [],
    volumes, chapterCount, volumeCount: volumes.length, cover: spec.cover
  };
});

const patches = [
  {
    id: 1, slug: 'chaos-child-fr', title: 'CHAOS;CHILD — Patch FR',
    alternativeTitles: ['カオスチャイルド'], vndbId: '', vndbUrl: '',
    developer: '5pb. / MAGES.', publisher: 'MAGES.', engine: 'MAGES. (Science Adventure)',
    platform: 'Windows', systems: ['Windows'], gameVersion: 'Steam / GOG, patch Committee of Zero 2.2.0',
    originalLanguage: 'Japonais', patchLanguage: 'Français', team: 'Saint Eresia',
    type: 'Traduction complète', status: 'Bêta',
    axes: { translation: 100, images: 18, technical: 100, proofreading: 60 },
    progress: 70, currentVersion: '', updatedAt: '2026-08-14',
    fileSize: '', downloads: 0, rating: 0,
    synopsis: 'Traduction française de CHAOS;CHILD, réalisée à partir du patch anglais de Committee of Zero. Le patch ne contient aucun fichier du jeu original.',
    requirements: [
      'Posséder légalement le jeu sur Steam ou GOG',
      'Avoir appliqué le patch anglais Committee of Zero 2.2.0'
    ],
    instructions: [
      'Télécharger et lancer l’installeur.',
      'L’installeur détecte automatiquement le jeu (Steam ou GOG) ; sinon, indiquer le dossier contenant Game.exe.',
      'Les fichiers d’origine sont sauvegardés avant remplacement : la désinstallation les restaure.'
    ],
    warnings: ['Ce téléchargement ne contient pas le jeu original.'],
    changelog: ['Scripts, dialogues et texte système traduits', 'Police accentuée et sous-titres des vidéos intégrés', 'Menus et CG en cours de reprise'],
    checksum: '', cover: '/assets/VN/chaoschild.webp', versions: []
  },
  {
    id: 2, slug: 'rance-01-fr', title: 'Rance 01 : La quête pour Hikari — Patch FR',
    alternativeTitles: ['ランス01 光をもとめて', 'Rance 01: The Quest for Hikari'],
    vndbId: '', vndbUrl: '',
    developer: 'AliceSoft', publisher: 'AliceSoft', engine: 'AliceSoft System',
    platform: 'Windows', systems: ['Windows'], gameVersion: 'Édition Windows',
    originalLanguage: 'Japonais', patchLanguage: 'Français', team: 'Saint Eresia',
    type: 'Traduction complète', status: 'En développement',
    axes: { translation: 0, images: 0, technical: 0, proofreading: 0 },
    progress: 0, currentVersion: '', updatedAt: '2026-08-14',
    fileSize: '', downloads: 0, rating: 0,
    synopsis: 'Traduction française du remake de Rance 01, développé par AliceSoft. Projet en cours de démarrage.',
    requirements: ['Posséder légalement le jeu original'],
    instructions: ['Les étapes d’installation seront publiées avec la première version du patch.'],
    warnings: ['Ce téléchargement ne contient pas le jeu original.', 'Œuvre réservée à un public adulte.'],
    changelog: [],
    checksum: '', cover: '/assets/VN/rance01.webp', versions: []
  }
];

module.exports = { novels, patches };
