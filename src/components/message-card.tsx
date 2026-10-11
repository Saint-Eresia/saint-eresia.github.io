// Encadré centré pour les messages simples (page introuvable, accès refusé, connexion…).
export function MessageCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[0_10px_30px_var(--shadow)]">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-accent-foreground [&_svg]:size-6">
        {icon}
      </div>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight">{title}</h1>
      <div className="mt-3 text-muted-foreground">{children}</div>
    </div>
  );
}
