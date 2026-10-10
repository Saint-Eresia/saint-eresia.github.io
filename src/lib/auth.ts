import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: db,
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
