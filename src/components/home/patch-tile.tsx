"use client";

import Link from "next/link";
import { CoverPlaceholder, statusTone } from "@/components/content-meta";
import { Badge } from "@/components/lightswind/badge";
import { InteractiveCard } from "@/components/lightswind/interactive-card";
import { Progress } from "@/components/lightswind/progress";
import { cn } from "@/lib/utils";

export type PatchTileData = {
  key: string;
  href: string;
  title: string;
  status: string;
  progress: number;
  date: string;
  cover: string | null;
};

// Patch de la liste de l’accueil : couverture, statut, avancement et date de mise à jour.
export function PatchTile({ patch }: { patch: PatchTileData }) {
  return (
    // Carte Lightswind sans inclinaison 3D : seul un léger reflet suit le pointeur (aucun si animations réduites).
    <InteractiveCard
      containerClassName="relative isolate h-full w-full"
      rotationFactor={0}
      borderRadius="1rem"
      InteractiveColor="hsl(349 74% 56% / 0.18)"
      tailwindBgClass="bg-card"
    >
      <Link
        href={patch.href}
        className="group flex h-full gap-4 rounded-2xl p-3.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <div className="aspect-[3/4] w-16 shrink-0 overflow-hidden rounded-lg border border-border">
          {patch.cover ? <img src={patch.cover} alt="" loading="lazy" className="h-full w-full object-cover" /> : <CoverPlaceholder title="" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="line-clamp-2 font-bold group-hover:text-primary">{patch.title}</p>
          <div className="mt-1.5">
            <Badge variant="unstyled" withDot size="sm" className={cn("border-transparent", statusTone(patch.status))}>
              {patch.status}
            </Badge>
          </div>
          <div className="mt-auto pt-3">
            <div className="flex items-baseline justify-between text-xs text-muted-foreground">
              <span>{patch.date}</span>
              <span className="font-bold text-foreground tabular-nums">{patch.progress} %</span>
            </div>
            <Progress
              value={patch.progress}
              size="sm"
              className="mt-1.5 h-1.5 bg-muted"
              indicatorClassName={patch.progress >= 100 ? "bg-success" : "bg-primary"}
              aria-label={`Avancement : ${patch.progress} %`}
            />
          </div>
        </div>
      </Link>
    </InteractiveCard>
  );
}
