"use client";

import Link from "next/link";
import { useState } from "react";
import { CoverPlaceholder, StatusBadge } from "@/components/content-meta";
import { cn } from "@/lib/utils";

export type FeedItem = {
  key: string;
  kind: "novel" | "patch";
  href: string;
  title: string;
  cover: string | null;
  status: string;
  detail: string;
  date: string; // déjà formatée
};

const KIND_LABELS = { novel: "Light novel", patch: "Patch VN" } as const;
const FILTERS = [
  { value: "all", label: "Tout" },
  { value: "novel", label: "Light novels" },
  { value: "patch", label: "Patchs VN" },
] as const;

// Feed de l’accueil : tous les projets, du plus récemment mis à jour au plus ancien, dans une liste qui défile.
export function HomeFeed({ items }: { items: FeedItem[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const shown = filter === "all" ? items : items.filter((item) => item.kind === filter);

  return (
    <>
      <div className="flex gap-1.5 border-b border-border px-5 py-3" role="group" aria-label="Filtrer le feed">
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
              filter === value ? "bg-accent text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="max-h-[26rem] min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain lg:max-h-none">
        {shown.length === 0 && <li className="px-5 py-10 text-center text-sm text-muted-foreground">Rien à afficher pour le moment.</li>}
        {shown.map((item) => (
          <li key={item.key}>
            <Link
              href={item.href}
              className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
            >
              <div className="aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-md border border-border">
                {item.cover ? (
                  <img src={item.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <CoverPlaceholder title="" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[0.7rem] font-extrabold tracking-[0.12em] text-primary uppercase">{KIND_LABELS[item.kind]}</p>
                <p className="truncate font-bold group-hover:text-primary">{item.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                  <StatusBadge status={item.status} />
                  <span>{item.detail}</span>
                  <span aria-hidden>·</span>
                  <span>{item.date}</span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
