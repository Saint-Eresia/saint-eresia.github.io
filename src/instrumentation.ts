// Au démarrage du serveur de développement : crée les tables de Better Auth si `npm run db:migrate` n’a pas été lancé.
// Sur Vercel, chaque démarrage à froid repartirait de zéro : la base distante est migrée une fois pour toutes
// depuis votre machine (npm run db:migrate, ou npm run db:cloud).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.VERCEL) return;
  const { getMigrations } = await import("better-auth/db/migration");
  const { auth } = await import("@/lib/auth");
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}
