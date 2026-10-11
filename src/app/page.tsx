import { ArrowRight, PenLine } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { FeaturedCarousel, type FeaturedSlide } from "@/components/featured-carousel";
import { HomeFeed, type FeedItem } from "@/components/home-feed";
import { NovelCard } from "@/components/novel-card";
import { CardsSkeleton, EmptyState } from "@/components/page-intro";
import { PatchCard } from "@/components/patch/patch-card";
import { Button } from "@/components/ui/button";
import { excerpt, listNews, newsDate } from "@/lib/news";
import { listFeaturedNovels, listNovels } from "@/lib/novels";
import { formatDate, imageUrl, listPatches } from "@/lib/patches";
import { getViewer } from "@/lib/viewer";

export default function HomePage() {
  return (
    <>
      <h1 className="sr-only">Saint Eresia : light novels et patchs de visual novels en français</h1>
      <Suspense fallback={<div className="h-[30rem] animate-pulse border-b border-border bg-secondary md:h-[28rem]" />}>
        <Recommended />
      </Suspense>
      <section className="relative isolate overflow-hidden border-b border-border bg-secondary/60">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(50rem_25rem_at_15%_-5rem,hsl(349_74%_56%/0.16),transparent_70%)]"
        />
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-10 sm:px-6 lg:h-[36rem] lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:py-12">
          <Panel eyebrow="Feed" title="Nos projets">
            <Suspense fallback={<PanelSkeleton />}>
              <Feed />
            </Suspense>
          </Panel>
          <Panel
            eyebrow="Actualités"
            title="Les dernières nouvelles"
            action={
              <Suspense fallback={null}>
                <WriteNewsLink />
              </Suspense>
            }
          >
            <Suspense fallback={<PanelSkeleton />}>
              <LatestNews />
            </Suspense>
          </Panel>
        </div>
      </section>

      <HomeSection title="Light novels" href="/novels">
        <Suspense fallback={<CardsSkeleton />}>
          <NovelGrid />
        </Suspense>
      </HomeSection>
      <HomeSection title="Patchs VN" href="/patchs">
        <Suspense fallback={<CardsSkeleton />}>
          <PatchGrid />
        </Suspense>
      </HomeSection>
    </>
  );
}

// Carrousel « Recommandé » : les novels cochés « Recommandé sur l’accueil » dans la gestion.
async function Recommended() {
  const novels = await listFeaturedNovels();
  const slides: FeaturedSlide[] = novels.map((novel) => ({
    key: `novel-${novel.id}`,
    href: `/novels/${novel.slug}`,
    title: novel.title,
    author: novel.author,
    status: novel.status,
    summary: excerpt(novel.synopsis, 320),
    quote: novel.quote,
    // Sans arrière-plan, la couverture sert de fond (floutée par le carrousel).
    background: novel.background ? imageUrl(novel.background) : novel.cover && imageUrl(novel.cover),
    logo: novel.logo && imageUrl(novel.logo),
    chapter: novel.latestChapter && {
      href: `/novels/${novel.slug}/${novel.latestChapter.slug}`,
      label: novel.latestChapter.label,
    },
  }));
  return <FeaturedCarousel slides={slides} />;
}

// Panneau de l’en-tête de l’accueil : hauteur fixe sur grand écran, le contenu défile à l’intérieur.
function Panel({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card/80 shadow-[0_24px_60px_rgb(0_0_0/0.25)] backdrop-blur">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <p className="text-xs font-extrabold tracking-[0.14em] text-primary uppercase">{eyebrow}</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function PanelSkeleton() {
  return (
    <div className="space-y-3 p-5" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

// Tous les projets (novels et patchs), du plus récemment mis à jour au plus ancien.
async function Feed() {
  const [novels, patches] = await Promise.all([listNovels(), listPatches()]);
  const entries: { updatedAt: string; item: FeedItem }[] = [
    ...novels.map((novel) => ({
      updatedAt: novel.updatedAt,
      item: {
        key: `novel-${novel.id}`,
        kind: "novel" as const,
        href: `/novels/${novel.slug}`,
        title: novel.title,
        cover: novel.cover && imageUrl(novel.cover),
        status: novel.status,
        detail: `${novel.publishedCount} chapitre${novel.publishedCount > 1 ? "s" : ""}`,
        date: `mis à jour le ${formatDate(novel.updatedAt)}`,
      },
    })),
    ...patches.map((patch) => ({
      updatedAt: patch.updatedAt,
      item: {
        key: `patch-${patch.id}`,
        kind: "patch" as const,
        href: `/patchs/${patch.slug}`,
        title: patch.title,
        cover: patch.cover && imageUrl(patch.cover),
        status: patch.status,
        detail: `${patch.progress} %`,
        date: `mis à jour le ${formatDate(patch.updatedAt)}`,
      },
    })),
  ];
  entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return <HomeFeed items={entries.map((entry) => entry.item)} />;
}

async function LatestNews() {
  const news = await listNews({ publishedOnly: true, limit: 5 });
  return (
    <>
      {news.length === 0 ? (
        <p className="flex-1 px-5 py-10 text-center text-sm text-muted-foreground">Aucune actualité pour le moment.</p>
      ) : (
        <ol className="min-h-0 flex-1 divide-y divide-border overflow-y-auto overscroll-contain">
          {news.map((item) => (
            <li key={item.id}>
              <Link
                href={`/actualites/${item.slug}`}
                className="group block px-5 py-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
              >
                <time dateTime={newsDate(item)} className="text-xs font-semibold text-muted-foreground">
                  {formatDate(newsDate(item))}
                </time>
                <p className="mt-0.5 font-bold group-hover:text-primary">{item.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{excerpt(item.content)}</p>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <Link
        href="/actualites"
        className="flex items-center justify-center gap-1 border-t border-border px-5 py-3 text-sm font-semibold text-primary hover:bg-muted/50"
      >
        Toutes les actualités <ArrowRight className="size-4" />
      </Link>
    </>
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

function HomeSection({ title, href, children }: { title: string; href: string; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
        <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          Tout voir <ArrowRight className="size-4" />
        </Link>
      </div>
      {children}
    </section>
  );
}

async function NovelGrid() {
  const novels = (await listNovels()).slice(0, 4);
  if (novels.length === 0) return <EmptyState>Aucun light novel pour le moment.</EmptyState>;
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      {novels.map((novel) => (
        <NovelCard key={novel.id} novel={novel} />
      ))}
    </div>
  );
}

async function PatchGrid() {
  const patches = (await listPatches()).slice(0, 4);
  if (patches.length === 0) return <EmptyState>Aucun patch n’est publié pour le moment.</EmptyState>;
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      {patches.map((patch) => (
        <PatchCard key={patch.id} patch={patch} />
      ))}
    </div>
  );
}
