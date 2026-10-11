import Link from "next/link";
import { patchHref } from "@/lib/patch-kinds";
import { imageUrl, type PatchWithImages } from "@/lib/patches";
import { CoverPlaceholder, ProgressBar, StatusBadge } from "@/components/content-meta";

export function PatchCard({ patch }: { patch: PatchWithImages }) {
  return (
    <Link
      href={patchHref(patch)}
      className="group flex h-full flex-col rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none"
    >
      <div className="aspect-[3/4] shrink-0 overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_30px_var(--shadow)] transition-[transform,box-shadow,border-color] duration-300 group-hover:-translate-y-1 group-hover:border-primary/50 group-hover:shadow-[0_18px_40px_var(--shadow)]">
        {patch.cover ? (
          <img
            src={imageUrl(patch.cover)}
            alt={patch.cover.alt}
            width={patch.cover.width}
            height={patch.cover.height}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <CoverPlaceholder title={patch.title} />
        )}
      </div>
      <div className="flex flex-1 flex-col px-1 pt-4">
        <h3 className="line-clamp-2 text-lg leading-snug font-bold transition-colors group-hover:text-primary">
          {patch.title}
        </h3>
        {/* Poussé en bas : statut et barre restent alignés d’une carte à l’autre, quelle que soit la longueur du titre. */}
        <div className="mt-auto pt-2">
          <div className="flex items-center justify-between gap-3">
            <StatusBadge status={patch.status} />
            <span className="text-sm font-semibold text-muted-foreground tabular-nums">{patch.progress} %</span>
          </div>
          <ProgressBar value={patch.progress} className="mt-3" />
        </div>
      </div>
    </Link>
  );
}
