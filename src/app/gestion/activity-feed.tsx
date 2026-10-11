import { BookOpen, ChevronLeft, ChevronRight, FileText, Gamepad2, Library, Newspaper, UserRound } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/lightswind/badge";
import { ScrollTimeline, type TimelineEvent } from "@/components/lightswind/scroll-timeline";
import { Button } from "@/components/ui/button";
import {
  ENTITY_TYPES,
  isEntityType,
  listActivity,
  listActivityActors,
  type ActivityAction,
  type ActivityRow,
  type EntityType,
} from "@/lib/activity";
import { cn } from "@/lib/utils";

export type FeedParams = { membre?: string; type?: string; page?: string };

const ACTIONS: Record<ActivityAction, { verb: string; label: string; tone: string }> = {
  create: { verb: "a créé", label: "Création", tone: "bg-success/15 text-success" },
  update: { verb: "a modifié", label: "Modification", tone: "bg-accent text-accent-foreground" },
  delete: { verb: "a supprimé", label: "Suppression", tone: "bg-destructive/15 text-destructive" },
};

// Article devant le type d’élément (« le patch », « l’actualité »…).
const NOUNS: Record<EntityType, string> = {
  patch: "le patch",
  novel: "le novel",
  volume: "le tome",
  chapter: "le chapitre",
  member: "le membre",
  news: "l’actualité",
};

const ICONS: Record<EntityType, React.ComponentType<{ className?: string }>> = {
  patch: Gamepad2,
  novel: BookOpen,
  volume: Library,
  chapter: FileText,
  member: UserRound,
  news: Newspaper,
};

const EDIT_PATHS: Partial<Record<EntityType, string>> = {
  patch: "/gestion/patchs",
  novel: "/gestion/novels",
  chapter: "/gestion/chapitres",
  member: "/gestion/equipe",
  news: "/gestion/actualites",
};

// Les dates du journal sont en UTC (SQLite) ; elles s’affichent à l’heure de Paris.
const when = (at: string) =>
  new Date(at.replace(" ", "T") + "Z").toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function entityLink(entry: ActivityRow) {
  const base = EDIT_PATHS[entry.entityType];
  const label = `« ${entry.entityLabel} »`;
  // Un élément supprimé n’a plus de page de gestion.
  if (!base || entry.entityId === null || entry.action === "delete") return <span>{label}</span>;
  return (
    <Link href={`${base}/${entry.entityId}`} className="text-primary underline-offset-4 hover:underline">
      {label}
    </Link>
  );
}

function toEvent(entry: ActivityRow): TimelineEvent {
  const action = ACTIONS[entry.action];
  const Icon = ICONS[entry.entityType];
  return {
    id: String(entry.id),
    year: <time dateTime={entry.at.replace(" ", "T") + "Z"}>{when(entry.at)}</time>,
    icon: <Icon className="size-3.5" aria-hidden />,
    title: (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>
          {entry.actorName} {action.verb} {NOUNS[entry.entityType]} {entityLink(entry)}
        </span>
        <Badge variant="unstyled" size="sm" className={cn("border-transparent", action.tone)}>
          {action.label}
        </Badge>
      </span>
    ),
    content:
      entry.changes.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-sm">
          {entry.changes.map((change, index) => (
            <li key={index} className="break-words">
              <span className="font-semibold">{change.field} :</span>{" "}
              <span className="text-muted-foreground">{change.before}</span>
              <span aria-hidden className="mx-1.5 text-primary">
                →
              </span>
              <span className="sr-only">devient</span>
              <span className="font-medium">{change.after}</span>
            </li>
          ))}
        </ul>
      ) : null,
  };
}

const feedHref = (params: FeedParams, page: number) => {
  const query = new URLSearchParams({ onglet: "activite" });
  if (params.membre) query.set("membre", params.membre);
  if (params.type) query.set("type", params.type);
  if (page > 1) query.set("page", String(page));
  return `/gestion?${query}`;
};

const selectClass =
  "h-11 rounded-full border border-input bg-background px-3 text-sm font-medium text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

// Feed d’activité de /gestion : du plus récent au plus ancien, filtres par membre et par type, pagination.
export async function ActivityFeed({ params }: { params: FeedParams }) {
  const type = params.type && isEntityType(params.type) ? params.type : undefined;
  const actors = await listActivityActors();
  const actorId = actors.some((actor) => actor.actorId === params.membre) ? params.membre : undefined;
  const filters: FeedParams = { membre: actorId, type };
  const { entries, total, page, pages } = await listActivity({ actorId, type, page: Number(params.page) || 1 });
  const filtered = Boolean(actorId || type);

  return (
    <section aria-labelledby="titre-activite">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="titre-activite" className="text-xl font-extrabold tracking-tight">
            Activité
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {total === 0 ? "Aucune modification" : `${total} modification${total > 1 ? "s" : ""}`}
            {filtered ? " pour ces filtres" : " enregistrée" + (total > 1 ? "s" : "")}.
          </p>
        </div>

        <form action="/gestion" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="onglet" value="activite" />
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            Membre
            <select name="membre" defaultValue={actorId ?? ""} className={selectClass}>
              <option value="">Tous</option>
              {actors.map((actor) => (
                <option key={actor.actorId} value={actor.actorId}>
                  {actor.actorName}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
            Élément
            <select name="type" defaultValue={type ?? ""} className={selectClass}>
              <option value="">Tous</option>
              {Object.entries(ENTITY_TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" size="pill" variant="outline">
            Filtrer
          </Button>
          {filtered && (
            <Button asChild size="pill" variant="ghost">
              <Link href="/gestion">Tout afficher</Link>
            </Button>
          )}
        </form>
      </div>

      {entries.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-border-strong p-8 text-center text-muted-foreground">
          {filtered
            ? "Aucune modification ne correspond à ces filtres."
            : "Les créations, modifications et suppressions faites dans la gestion apparaîtront ici."}
        </p>
      ) : (
        <ScrollTimeline events={entries.map(toEvent)} className="mt-6" />
      )}

      {pages > 1 && (
        <nav aria-label="Pages du feed d’activité" className="mt-8 flex items-center justify-center gap-3">
          {page > 1 ? (
            <Button asChild size="pill" variant="outline">
              <Link href={feedHref(filters, page - 1)} rel="prev">
                <ChevronLeft /> Plus récentes
              </Link>
            </Button>
          ) : null}
          <span className="text-sm font-semibold text-muted-foreground tabular-nums" aria-current="page">
            Page {page} sur {pages}
          </span>
          {page < pages ? (
            <Button asChild size="pill" variant="outline">
              <Link href={feedHref(filters, page + 1)} rel="next">
                Plus anciennes <ChevronRight />
              </Link>
            </Button>
          ) : null}
        </nav>
      )}
    </section>
  );
}
