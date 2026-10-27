import { Badge } from "@/components/lightswind/badge";
import { Progress } from "@/components/lightswind/progress";
import { cn } from "@/lib/utils";

// Format par défaut d’une couverture de light novel ou de web novel (proche du format bunko) :
// les listes l’imposent pour garder des cartes alignées ; la fiche montre la couverture dans ses proportions.
export const NOVEL_COVER = "aspect-[2/3]";

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

// Badge de statut (Lightswind, sans relief 3D) aux couleurs du statut.
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <Badge variant="unstyled" withDot className={cn("w-fit border-transparent", statusTone(status), className)}>
      {status}
    </Badge>
  );
}

// Barre d’avancement (Lightswind) : couleur principale, verte une fois à 100 %.
export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <Progress
      value={value}
      size="sm"
      color={value >= 100 ? "success" : "primary"}
      aria-label="Avancement"
      className={cn("h-1.5 bg-muted", className)}
    />
  );
}

export function CoverPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-accent to-secondary p-3 text-center text-sm font-semibold text-accent-foreground">
      {title}
    </div>
  );
}
