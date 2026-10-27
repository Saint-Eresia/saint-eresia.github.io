import { randomInt } from "node:crypto";
import { ArrowRight, PenLine } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { CoverPlaceholder, NOVEL_COVER, StatusBadge } from "@/components/content-meta";
import { FeaturedCarousel, type FeaturedSlide } from "@/components/featured-carousel";
import { PatchTile } from "@/components/home/patch-tile";
import { EmptyState } from "@/components/page-intro";
import { Button } from "@/components/ui/button";
import { excerpt, listNews, newsDate } from "@/lib/news";
import { latestReleases, listFeaturedNovels, listNovels } from "@/lib/novels";
import { PATCH_KINDS, patchHref, type PatchKind } from "@/lib/patch-kinds";
import { formatDate, imageUrl, listFeaturedPatches, listPatches } from "@/lib/patches";
import { getViewer } from "@/lib/viewer";

export default function HomePage() {
  return (
    <>
      <h1 className="sr-only">Saint Eresia : patchs de visual novels et light novels en français</h1>
      <Suspense fallback={<div className="h-[36rem] animate-pulse border-b border-border bg-secondary sm:h-[34rem] lg:h-[35rem]" />}>
        <Recommended />
      </Suspense>

      {/* Les patchs VN d’abord : l’un d’eux en grand, puis les autres par dernière mise à jour. */}
      <section aria-labelledby="patchs-titre" className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <SectionHeading id="patchs-titre" title="Patchs VN" href="/patchs" link="Tous les patchs" />
        <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
          <Patches kind="vn" />
        </Suspense>
      </section>

      {/* Jeux vidéo hors visual novels : la section n’apparaît que s’il y en a. */}
      <Suspense fallback={null}>
        <GamesSection />
      </Suspense>

      {/* Light novels et actualités, en plus compact. */}
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-14 sm:px-6 lg:grid-cols-2">
        <section aria-labelledby="novels-titre" className="min-w-0">
          <SectionHeading id="novels-titre" title="Light novels" href="/novels" link="Tous les novels" small />
          <Suspense fallback={<ListSkeleton />}>
            <CompactNovels />
          </Suspense>
        </section>
        <section aria-labelledby="actus-titre" className="min-w-0">
          <SectionHeading
            id="actus-titre"
            title="Actualités"
            href="/actualites"
            link="Toutes les actualités"
            small
            action={
              <Suspense fallback={null}>
                <WriteNewsLink />
              </Suspense>
            }
          />
          <Suspense fallback={<ListSkeleton />}>
            <CompactNews />
          </Suspense>
        </section>
      </div>
    </>
  );
}

function SectionHeading({
  id,
  title,
  href,
  link,
  small = false,
  action,
}: {
  id: string;
  title: string;
  href: string;
  link: string;
  small?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <h2 id={id} className={small ? "text-xl font-extrabold tracking-tight" : "text-2xl font-extrabold tracking-tight sm:text-3xl"}>
        {title}
      </h2>
      <div className="flex items-center gap-3">
        {action}
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          {link} <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

// Carrousel « Recommandé » : nombre de diapositives tirées à chaque chargement, et durée d’affichage de chacune.
const RECOMMENDED_COUNT = 3;
const RECOMMENDED_DELAY_SECONDS = 8;

// Mélange aléatoire (Fisher-Yates), refait à chaque requête : la page est rendue à la demande, jamais figée au build.
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Premier paragraphe seulement : la suite d’une description de patch contient des titres (Prérequis, Installation…).
const firstParagraph = (markdown: string) => markdown.split(/\n\s*\n/)[0] ?? "";

// Carrousel « Recommandé » : novels et patchs cochés « Recommandé sur l’accueil » dans la gestion,
// 3 tirés au hasard à chaque chargement, dont au moins un patch (l’accueil est centré sur les patchs).
// Tant qu’aucun patch n’est coché, un patch est tiré parmi tous les patchs.
async function Recommended() {
  const [novels, featuredPatches, allPatches] = await Promise.all([listFeaturedNovels(), listFeaturedPatches(), listPatches()]);
  const patchPool = featuredPatches.length ? featuredPatches : allPatches;

  const novelSlides: FeaturedSlide[] = novels.map((novel) => ({
    key: `novel-${novel.id}`,
    kindLabel: "Light novel",
    href: `/novels/${novel.slug}`,
    title: novel.title,
    byline: novel.author ? `par ${novel.author}` : "",
    status: novel.status,
    summary: excerpt(novel.synopsis, 320),
    quote: novel.quote,
    // Sans arrière-plan, la couverture sert de fond (floutée par le carrousel).
    background: novel.background ? imageUrl(novel.background) : novel.cover && imageUrl(novel.cover),
    logo: novel.logo && imageUrl(novel.logo),
    action: novel.latestChapter && {
      href: `/novels/${novel.slug}/${novel.latestChapter.slug}`,
      label: `Dernier chapitre (${novel.latestChapter.label})`,
      kind: "read" as const,
    },
    progress: null,
  }));
  const patchSlides: FeaturedSlide[] = patchPool.map((patch) => ({
    key: `patch-${patch.id}`,
    kindLabel: PATCH_KINDS[patch.kind].label,
    href: patchHref(patch),
    title: patch.title,
    byline: "",
    status: patch.status,
    summary: excerpt(firstParagraph(patch.description), 220),
    quote: patch.quote,
    background: patch.background ? imageUrl(patch.background) : patch.cover && imageUrl(patch.cover),
    logo: patch.logo && imageUrl(patch.logo),
    action: patch.downloadUrl ? { href: patch.downloadUrl, label: "Télécharger le patch", kind: "download" as const } : null,
    progress: { value: patch.progress, steps: patch.steps },
  }));

  const [firstPatch, ...otherPatches] = shuffle(patchSlides);
  const rest = shuffle([...otherPatches, ...novelSlides]).slice(0, RECOMMENDED_COUNT - (firstPatch ? 1 : 0));
  const slides = firstPatch ? [firstPatch, ...rest] : rest;
  return <FeaturedCarousel slides={slides} delaySeconds={RECOMMENDED_DELAY_SECONDS} />;
}

async function GamesSection() {
  const games = await listPatches("jeu");
  if (games.length === 0) return null;
  return (
    <section aria-labelledby="jeux-titre" className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <SectionHeading id="jeux-titre" title="Jeux" href="/jeux" link="Tous les jeux" />
      <PatchTiles patches={games} />
    </section>
  );
}

// Les patchs d’un type, du plus récemment mis à jour au plus ancien.
async function Patches({ kind }: { kind: PatchKind }) {
  const patches = await listPatches(kind); // déjà triés par dernière mise à jour
  if (patches.length === 0) return <EmptyState>Aucun patch n’est publié pour le moment.</EmptyState>;
  return <PatchTiles patches={patches} />;
}

function PatchTiles({ patches }: { patches: Awaited<ReturnType<typeof listPatches>> }) {
  return (
    <div>
      {patches.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {patches.map((patch) => (
            <li key={patch.id}>
              <PatchTile
                patch={{
                  key: `patch-${patch.id}`,
                  href: patchHref(patch),
                  title: patch.title,
                  status: patch.status,
                  progress: patch.progress,
                  date: `Mis à jour le ${formatDate(patch.updatedAt)}`,
                  cover: patch.cover && imageUrl(patch.cover),
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

async function CompactNovels() {
  const [all, releases] = await Promise.all([listNovels(), latestReleases()]);
  if (all.length === 0) return <EmptyState>Aucun light novel pour le moment.</EmptyState>;
  // Du plus récemment sorti au plus ancien ; un novel sans chapitre publié passe après.
  const novels = all
    .map((novel) => ({ ...novel, latest: releases.get(Number(novel.id)) ?? null }))
    .sort((a, b) => (b.latest?.date ?? "").localeCompare(a.latest?.date ?? ""));
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {novels.slice(0, 5).map((novel) => (
        <li key={novel.id}>
          <Link
            href={`/novels/${novel.slug}`}
            className="group flex items-center gap-3.5 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
          >
            <div className={`${NOVEL_COVER} w-10 shrink-0 overflow-hidden rounded-md`}>
              {novel.cover ? (
                <img src={imageUrl(novel.cover)} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <CoverPlaceholder title="" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold group-hover:text-primary">{novel.title}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {novel.latest
                  ? `${novel.latest.label} · ${formatDate(novel.latest.date)}`
                  : `${novel.publishedCount} chapitre${novel.publishedCount > 1 ? "s" : ""}`}
              </p>
            </div>
            <StatusBadge status={novel.status} className="hidden sm:inline-flex" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function CompactNews() {
  const news = await listNews({ publishedOnly: true, limit: 5 });
  if (news.length === 0) {
    return <p className="rounded-2xl border border-dashed border-border-strong p-8 text-center text-muted-foreground">Aucune actualité pour le moment.</p>;
  }
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
      {news.map((item) => (
        <li key={item.id}>
          <Link
            href={`/actualites/${item.slug}`}
            className="group block px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
          >
            <time dateTime={newsDate(item)} className="text-xs font-semibold text-muted-foreground">
              {formatDate(newsDate(item))}
            </time>
            <p className="mt-0.5 font-bold group-hover:text-primary">{item.title}</p>
            <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{excerpt(item.content, 140)}</p>
          </Link>
        </li>
      ))}
    </ol>
  );
}

// Raccourci vers l’écriture d’une actualité, pour les membres de l’équipe.
async function WriteNewsLink() {
  const viewer = await getViewer();
  if (!viewer?.isTeam) return null;
  return (
    <Button asChild variant="outline" size="sm">
      <Link href="/gestion/actualites/nouveau">
        <PenLine /> Écrire
      </Link>
    </Button>
  );
}
