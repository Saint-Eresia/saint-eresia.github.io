// Au démarrage du serveur : crée les tables de Better Auth si `npm run db:migrate` n’a pas été lancé.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getMigrations } = await import("better-auth/db/migration");
  const { auth } = await import("@/lib/auth");
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}
