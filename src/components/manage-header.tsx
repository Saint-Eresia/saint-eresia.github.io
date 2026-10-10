import { ArrowLeft } from "lucide-react";
import Link from "next/link";

// En-tête des pages de gestion : lien de retour, titre, actions à droite, message après création.
export function ManageHeader({
  back,
  title,
  actions,
  created,
}: {
  back: { href: string; label: string };
  title: string;
  actions?: React.ReactNode;
  created?: string | false;
}) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link
            href={back.href}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> {back.label}
          </Link>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-balance">{title}</h1>
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </div>
      {created && (
        <p role="status" className="mt-5 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm">
          {created}
        </p>
      )}
    </>
  );
}

export const panel = "rounded-2xl border border-border bg-card p-6 sm:p-8";
