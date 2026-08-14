# Saint Eresia

Saint Eresia est une plateforme HTML/CSS/JavaScript Vanilla francophone consacrée à la lecture de Light Novels et Web Novels, ainsi qu’à la diffusion de patchs français autorisés pour Visual Novels et autres jeux narratifs.

La nouvelle application est isolée dans `public/` et `server/`. Le miroir statique historique n’est jamais exécuté par Express. Un audit détaillé est disponible dans [AUDIT.md](AUDIT.md) et les fichiers historiques représentatifs ont été conservés dans `_legacy_backup/`.

## Prérequis

- Node.js 20 ou supérieur (testé syntaxiquement avec Node 24)
- npm
- PostgreSQL 15 ou supérieur pour la persistance de production
- Optionnel : un bucket compatible S3 ou Cloudflare R2

## Installation

```powershell
Copy-Item .env.example .env
npm.cmd install
```

Sous macOS ou Linux, utilisez simplement `npm install`.

En développement immédiat, laissez `DATABASE_URL` vide dans `.env` pour utiliser les données fictives en mémoire. Cela permet de parcourir et tester l’interface sans service externe. Pour tester la persistance PostgreSQL :

```powershell
createdb saint_eresia
npm.cmd run db:migrate
npm.cmd run db:seed
```

Ne conservez jamais les secrets proposés dans `.env.example` en production. Générez notamment `SESSION_SECRET` avec au moins 32 caractères aléatoires.

## Lancement

```powershell
npm.cmd run dev
# ou
npm.cmd start
```

Ouvrez ensuite `http://localhost:3000`.

## Comptes de développement

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Administrateur | `admin@saint-eresia.local` | `AdminEresia!2026` |
| Utilisateur | `lecteur@saint-eresia.local` | `LecteurEresia!2026` |

Ces comptes sont exclusivement destinés au développement. Le script de données hache leurs mots de passe avec bcrypt.

## Commandes

```powershell
npm.cmd start          # serveur de production
npm.cmd run dev        # serveur avec rechargement
npm.cmd run db:migrate # applique les migrations PostgreSQL
npm.cmd run db:seed    # insère les contenus fictifs et comptes de développement
npm.cmd test           # tests d’API et d’autorisations
npm.cmd run check      # syntaxe serveur puis tests
```

## Arborescence principale

```text
public/
├── admin/                 # dashboard et formulaires protégés
├── assets/                # visuels SVG originaux
├── css/styles.css         # DA sombre rouge/noir conservée
├── js/                    # interface, lecteur et administration
├── index.html
├── novels.html / novel.html / reader.html
├── patchs.html / patch.html
├── favorites.html / reading-list.html / history.html
├── login.html / register.html / profile.html
└── pages légales, manifest, sitemap, robots et 404
server/
├── app.js
├── config/
├── data/
├── database/
│   ├── migrations/001_initial.sql
│   ├── schema.sql
│   └── seed.js
├── middleware/
├── repositories/
├── routes/
├── services/
└── tests/
```

## Fonctionnalités

- Accueil, catalogues paginés, recherche avec debounce, filtres conservés dans l’URL et tris.
- 8 Light Novels, 4 Web Novels et 6 patchs entièrement fictifs, avec volumes, chapitres et versions.
- Fiches détaillées, favoris, liste de lecture et historique sans rechargement pour les mutations.
- Lecteur de texte avec thèmes sombre/clair/sépia, largeur, taille, interligne, police, signets, mode sans distraction, raccourcis, reprise et synchronisation.
- Sessions HTTP-only, mots de passe bcrypt, CSRF, rate limiting, Helmet/CSP, validation, assainissement HTML et contrôle des rôles côté serveur.
- Dashboard cohérent avec le site, éditeur de chapitre avec brouillon local, aperçu, compteur, programmation et publication.
- Uploads avec limites, MIME/extensions, noms uniques, optimisation WebP avec Sharp et SHA-256 pour les archives.
- Stockage local en développement ; adaptateur S3/R2 et URLs signées en production.
- Schéma PostgreSQL avec contraintes, index, clés étrangères, suppressions logiques et journal d’audit.
- SEO public, JSON-LD, favicon original, manifest, sitemap, robots, accessibilité clavier et réduction des animations.

## API

Toutes les routes sont préfixées par `/api`. Les mutations authentifiées exigent le jeton renvoyé par `GET /api/auth/me` dans l’en-tête `x-csrf-token`. Les routes de gestion sont protégées par rôle côté serveur.

Les groupes principaux sont : `/auth`, `/novels`, `/volumes`, `/chapters`, `/patches`, `/patch-versions`, `/users/me`, `/uploads` et `/admin`.

## Stockage S3 / R2

Définissez `STORAGE_DRIVER=s3` ou `r2`, puis renseignez `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` et `S3_SECRET_ACCESS_KEY`. Les objets sont rangés par catégorie. Les fichiers de patch ne sont pas exposés comme répertoires publics et l’adaptateur peut générer une URL signée de cinq minutes.

## Sécurité opérationnelle

- Utiliser HTTPS et `NODE_ENV=production` afin d’activer le cookie `Secure`.
- Renseigner `TRUST_PROXY=1` derrière un reverse proxy de confiance.
- Limiter les droits du compte PostgreSQL et du bucket.
- Vérifier les archives avec un antivirus en production avant publication.
- Remplacer l’envoi de réinitialisation simulé par un fournisseur e-mail transactionnel.
- Sauvegarder PostgreSQL et le stockage objet séparément.

## Vérification manuelle responsive

Tester l’accueil, les deux catalogues, les deux fiches, le lecteur et l’administration aux formats 390×844, 768×1024, 1024×768 et 1440×900. Les seuils principaux sont 480, 768 et 1024 px ; `prefers-reduced-motion` est respecté.

## Limites connues

- Sans `DATABASE_URL`, les mutations du jeu de démonstration sont volatiles au redémarrage. Le schéma et le chargement PostgreSQL sont fournis pour la persistance, mais l’adaptateur de lecture/écriture SQL métier doit être activé dans un déploiement final à la place du dépôt mémoire.
- La vérification d’e-mail et l’envoi de réinitialisation sont simulés : aucun fournisseur SMTP n’est configuré.
- Les archives fictives ne sont pas livrées ; le bouton de téléchargement valide et journalise la demande sans distribuer de jeu ni de contenu tiers.
- L’analyse antivirus des archives, la génération d’AVIF et les miniatures multiples restent des tâches d’infrastructure de production.

## Incident d’installation dans cet environnement

L’environnement Windows utilisé pour cette transformation refuse actuellement la chaîne de certificats du registre npm (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`). TLS n’a pas été désactivé. Il faut installer le certificat d’autorité approprié ou configurer `cafile` dans npm avant de relancer `npm.cmd install`.
