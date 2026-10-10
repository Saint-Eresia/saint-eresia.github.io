import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { client } from "@/lib/db";
import { LibsqlDialect } from "@/lib/kysely-libsql";

export const auth = betterAuth({
  // Même connexion libSQL que le reste du site (SQLite en local, Turso en production).
  database: { dialect: new LibsqlDialect(client), type: "sqlite" },
  // Sur Vercel, la vérification du schéma au démarrage partirait pendant un pré-rendu Next (requête annulée) :
  // les tables y sont garanties par `npm run db:cloud` / `db:migrate`.
  advanced: { database: { validateSchema: !process.env.VERCEL } },
  socialProviders: {
    discord: {
      clientId: process.env.DISCORD_CLIENT_ID as string,
      clientSecret: process.env.DISCORD_CLIENT_SECRET as string,
      // Pas d’adresse e-mail : seulement le profil et les rôles du membre sur le serveur de l’équipe.
      disableDefaultScope: true,
      scope: ["identify", "guilds.members.read"],
      // Better Auth exige une adresse : on en fabrique une, non routable, à partir de l’identifiant Discord.
      mapProfileToUser: (profile) => ({ email: `${profile.id}@discord.invalid`, emailVerified: false }),
    },
  },
  plugins: [nextCookies()],
});
