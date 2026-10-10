# Saint Eresia

Site de Saint Eresia : light novels à lire en ligne et patchs français de visual novels.
Next.js 16 (App Router), Tailwind, shadcn/ui, SQLite et Better Auth (Discord).

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

Le dossier `data/` contient toutes les données : il faut le sauvegarder et le conserver entre deux déploiements.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm run dev` | serveur de développement |
| `npm run build` puis `npm start` | production |
| `npm run db:migrate` | crée ou met à jour les tables de la base |
| `npm run db:seed` | importe le contenu d’origine (`scripts/seed-data/`), sans effet sur ce qui existe déjà |
| `npm run lint` | vérification ESLint |
