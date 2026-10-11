import { cn } from "@/lib/utils";

const TONES: Record<string, string> = {
  Terminé: "bg-success/15 text-success",
  Publiée: "bg-success/15 text-success",
  Brouillon: "bg-muted text-muted-foreground",
  Stable: "bg-success/15 text-success",
  Obsolète: "bg-muted text-muted-foreground",
  Abandonné: "bg-muted text-muted-foreground",
  "En pause": "bg-warning/15 text-warning",
  Licencié: "bg-muted text-muted-foreground",
};

// Couleurs des statuts, réutilisées par les badges Lightswind de l’accueil.
export const statusTone = (status: string) => TONES[status] ?? "bg-accent text-accent-foreground";

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONES[status] ?? "bg-accent text-accent-foreground",
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Avancement"
      className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className={cn("h-full rounded-full", value >= 100 ? "bg-success" : "bg-primary")}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function CoverPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent to-secondary p-3 text-center text-sm font-semibold text-accent-foreground">
      {title}
    </div>
  );
}
