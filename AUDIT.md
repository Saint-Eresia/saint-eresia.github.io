# Audit du dépôt d'origine

Audit réalisé le 4 août 2026 avant la transformation en Saint Eresia.

## Inventaire

- 23 050 fichiers environ, pour 1,26 Go.
- `pages/` : 5 758 captures HTML (accueil, catalogue, authentification, fiches et milliers de chapitres illustrés).
- `api/` : 5 759 relevés d'endpoints.
- `backend/` : 11 519 relevés d'en-têtes et de technologies, sans code serveur exécutable.
- `css/` : deux bundles minifiés, dont un bundle applicatif d'environ 606 Ko.
- `js/` : cinq scripts compilés/minifiés.
- `metadata/` : sitemap, robots, security et descriptions de formulaires.

Le dépôt initial n'est donc pas le code source de l'application d'origine, mais une copie de pages rendues et de résultats d'exploration.

## Direction artistique conservée

- Fond presque noir (`0 0% 3.9%`) et cartes sombres.
- Rouge primaire (`0 72.2% 50.6%`) et texte blanc/gris.
- Bordures très sombres, rayon de 5 à 11 px, ombres discrètes.
- Typographie sans-serif compacte, grille de couvertures, listes latérales et navigation horizontale.
- Transitions courtes, survol rouge, barre de progression et menu mobile.
- Breakpoints observés : 520, 639, 700, 768, 900 et 1024 px.

## Éléments retirés ou non repris

- Google Analytics / Google Tag Manager.
- Script de décodage d'e-mail Cloudflare.
- Bundles compilés dont le comportement complet ne peut pas être garanti.
- Appels vers `hivetoons.org`, `api.hivetoons.org`, `storage.hivetoon.com` et `dashboard.hivetoons.org`.
- Ressources de couvertures provenant de CDN tiers et liens Discord.
- Contenus, titres et images issus du site copié.
- Lecteur vertical d'images, achats de chapitres et vocabulaire de bande dessinée asiatique.

## Sauvegarde

Les fichiers représentatifs essentiels sont copiés dans `_legacy_backup/` avant modification. Le miroir original reste également intact dans ses dossiers historiques ; la nouvelle application est isolée dans `public/` et `server/`.
