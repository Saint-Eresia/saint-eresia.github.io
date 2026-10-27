"use client";

import { Check } from "lucide-react";
import { createContext, use, useSyncExternalStore, type ReactNode } from "react";
import { parseProgress, rawProgress } from "@/lib/reading-progress";

// Chapitres lus dans le sommaire, d’après la dernière lecture mémorisée par ce navigateur (« Reprendre la lecture ») :
// ceux qui la précèdent sont lus, elle-même est en cours. Rien côté serveur ni avant l’hydratation.
type Mark = "lu" | "en-cours";
const Marks = createContext<Map<string, Mark>>(new Map());

const noop = () => () => {};

// `chapters` : slugs des chapitres publiés, dans l’ordre de lecture.
export function ReadMarks({ novelSlug, chapters, children }: { novelSlug: string; chapters: string[]; children: ReactNode }) {
  const raw = useSyncExternalStore(noop, () => rawProgress(novelSlug), () => null);
  const current = parseProgress(raw)?.slug;
  const index = current ? chapters.indexOf(current) : -1;
  const marks = new Map<string, Mark>(index < 0 ? [] : chapters.slice(0, index + 1).map((slug, i) => [slug, i === index ? "en-cours" : "lu"]));
  return <Marks value={marks}>{children}</Marks>;
}

// Titre d’un chapitre du sommaire : puce, coche (lu) ou mention « En cours ».
export function ChapterTitle({ slug, children }: { slug: string; children: ReactNode }) {
  const mark = use(Marks).get(slug);
  if (mark === "lu") {
    return (
      <span className="text-muted-foreground group-hover:text-primary">
        <Check aria-hidden className="mr-1.5 inline size-3.5 align-[-0.1em]" />
        <span className="sr-only">Lu : </span>
        {children}
      </span>
    );
  }
  return (
    <>
      <span aria-hidden className="mr-1.5 text-primary">
        •
      </span>
      {children}
      {mark === "en-cours" && (
        <span className="ml-2 rounded-full border border-border px-2 py-0.5 align-middle text-[0.7rem] font-semibold text-muted-foreground">
          En cours
        </span>
      )}
    </>
  );
}
