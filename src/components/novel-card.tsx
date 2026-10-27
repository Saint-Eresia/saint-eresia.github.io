import Link from "next/link";
import { CoverPlaceholder, NOVEL_COVER, StatusBadge } from "@/components/content-meta";
import type { listNovels } from "@/lib/novels";
import { imageUrl } from "@/lib/patches";

type NovelListItem = Awaited<ReturnType<typeof listNovels>>[number];

export function NovelCard({ novel }: { novel: NovelListItem }) {
  return (
    <Link
      href={`/novels/${novel.slug}`}
      className="group flex h-full flex-col rounded-2xl focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none"
    >
      <div
        className={`${NOVEL_COVER} shrink-0 overflow-hidden rounded-2xl bg-card shadow-[0_10px_30px_var(--shadow)] transition-[transform,box-shadow] duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_var(--shadow)]`}
      >
        {novel.cover ? (
          <img
            src={imageUrl(novel.cover)}
            alt={novel.cover.alt}
            width={novel.cover.width}
            height={novel.cover.height}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <CoverPlaceholder title={novel.title} />
        )}
      </div>
      <div className="flex flex-1 flex-col px-1 pt-4">
        <h3 className="line-clamp-2 text-lg leading-snug font-bold transition-colors group-hover:text-primary">{novel.title}</h3>
        {novel.author && <p className="mt-0.5 text-sm text-muted-foreground">{novel.author}</p>}
        {/* Poussé en bas : le statut reste aligné d’une carte à l’autre, quelle que soit la longueur du titre. */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2">
          <StatusBadge status={novel.status} />
          <span className="text-sm font-semibold text-muted-foreground tabular-nums">
            {novel.publishedCount} {novel.publishedCount > 1 ? "chapitres" : "chapitre"}
          </span>
        </div>
      </div>
    </Link>
  );
}
