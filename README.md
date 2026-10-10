# Saint Eresia

Site de Saint Eresia : light novels à lire en ligne et patchs français de visual novels.
Next.js 16 (App Router), Tailwind, shadcn/ui, SQLite/libSQL et Better Auth (Discord).
En local, tout tient dans `data/` ; en production (Vercel), la base est sur Turso et les images sur Vercel Blob.

## Installation

```bash
npm install
cp .env.example .env      # puis remplir les valeurs
npm run db:migrate        # crée les tables (data/saint-eresia.db)
npm run db:seed           # importe le contenu de l’ancien site : patchs, novels, équipe, images
npm run dev
```

Dans l’application Discord, déclarez l’URL de redirection `{BETTER_AUTH_URL}/api/auth/callback/discord`.

## Fonctionnement

- **Consultation** : tout le monde peut lire les novels et voir les patchs, connecté ou non.
- **Gestion** (`/gestion`) : réservée aux comptes Discord qui ont l’un des rôles `DISCORD_TEAM_ROLES` sur le serveur `DISCORD_GUILD_ID`. Les rôles sont lus avec le jeton de l’utilisateur (scope `guilds.members.read`) et gardés 5 minutes en mémoire. Chaque action serveur et chaque envoi d’images revérifient ces droits.
- **Light novels** : un novel contient des tomes, qui contiennent des chapitres. Un chapitre en brouillon n’est visible que dans la gestion. Pour un tome lu d’un bloc, créez un seul chapitre nommé « Tome N ». L’adresse publique d’un chapitre est fixée à sa création.
- **Équipe** : les membres affichés sur `/equipe` se gèrent dans `/gestion` (rôles et projets, liens, avatar recadré en carré).
- **Accès complet** : les identifiants Discord listés dans `DISCORD_ADMIN_IDS` ont toujours accès à la gestion, même sans rôle sur le serveur.
- **Images** : converties en WebP avec sharp, stockées dans `data/uploads/`, servies par `/uploads/<fichier>`. Dans l’éditeur de chapitre, une image glissée dans le texte est insérée à l’emplacement du curseur.

En local, le dossier `data/` contient toutes les données : à sauvegarder. En production, elles sont sur Turso et Vercel Blob (voir ci-dessous).

## Déploiement sur Vercel

Vercel n’a pas de disque persistant : un fichier SQLite ou un dossier d’images y serait effacé à chaque déploiement.
Le site utilise donc, dès que les variables correspondantes sont définies :

- **Turso** (https://turso.tech, offre gratuite) pour la base : même SQL que SQLite, aucune autre modification.
- **Vercel Blob** pour les images : l’adresse publique de chaque image est gardée en base.

Étapes :

1. **Base Turso** : installez le CLI (`turso auth signup`), puis
   `turso db create saint-eresia`, `turso db show saint-eresia --url` et `turso db tokens create saint-eresia`.
   Reportez l’URL (`libsql://…`) et le jeton dans `.env` : `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`.
2. **Blob** : dans le projet Vercel, onglet *Storage* → *Create Database* → *Blob*. Copiez `BLOB_READ_WRITE_TOKEN` dans `.env`.
3. **Migration du contenu existant** : `npm run db:cloud` crée les tables sur Turso, copie `data/saint-eresia.db`
   (patchs, novels, chapitres, équipe) et envoie `data/uploads/` sur Blob. Relançable sans doublon.
   Sur une base vide, `npm run db:migrate` puis `npm run db:seed` font la même chose avec le contenu d’origine.
4. **Variables d’environnement du projet Vercel** (*Settings → Environment Variables*) : toutes celles de `.env.example`,
   avec `BETTER_AUTH_URL=https://<votre-site>.vercel.app` (sans barre finale).
5. **Discord** : ajoutez `https://<votre-site>.vercel.app/api/auth/callback/discord` aux URL de redirection de l’application.
6. **Déployez** : importez le dépôt GitHub dans Vercel (framework détecté : Next.js, rien à configurer), ou `npx vercel --prod`.

Notes :

- Les comptes Discord ne sont pas migrés : chacun se reconnecte sur le nouveau site.
- Sur Vercel, le corps d’une requête est limité à 4,5 Mo : les images envoyées depuis la gestion doivent faire moins de 4 Mo
  (25 Mo en local). Au besoin, réduisez l’image avant de l’envoyer.
- Si `TURSO_DATABASE_URL` est défini dans votre `.env` local, `npm run dev` travaille directement sur la base de production.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` | serveur de développement |
| `npm run build` puis `npm start` | production |
| `npm run db:migrate` | crée ou met à jour les tables de la base |
| `npm run db:seed` | importe le contenu d’origine (`scripts/seed-data/`), sans effet sur ce qui existe déjà |
| `npm run db:cloud` | copie `data/` (base et images) vers Turso et Vercel Blob déclarés dans `.env` |
| `npm run lint` | vérification ESLint |
