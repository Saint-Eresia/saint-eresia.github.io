import { ArrowRight, BookOpen, Gamepad2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { NovelCard } from "@/components/novel-card";
import { CardsSkeleton, EmptyState } from "@/components/page-intro";
import { PatchCard } from "@/components/patch/patch-card";
import { Button } from "@/components/ui/button";
import { listNovels } from "@/lib/novels";
import { imageUrl, listPatches } from "@/lib/patches";

export default function HomePage() {
  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-border bg-secondary/60">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(50rem_25rem_at_15%_-5rem,hsl(349_74%_56%/0.16),transparent_70%)]"
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.2fr_1fr] md:py-20">
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-primary uppercase">Light novels & visual novels</p>
            <h1 className="mt-4 text-4xl leading-[1.1] font-extrabold tracking-tight text-balance sm:text-5xl">
              Des histoires qui méritent d’être lues en français.
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              Saint Eresia traduit des light novels, à lire directement ici, et publie des patchs français pour visual
              novels.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="pill">
                <Link href="/novels">
                  <BookOpen /> Lire les novels
                </Link>
              </Button>
              <Button asChild variant="outline" size="pill">
                <Link href="/patchs">
                  <Gamepad2 /> Patchs VN
                </Link>
              </Button>
            </div>
          </div>
          <Suspense fallback={<div className="h-80" />}>
            <CoverStack />
          </Suspense>
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

// Les dernières couvertures (novels et patchs), disposées en éventail.
async function CoverStack() {
  const [novels, patches] = await Promise.all([listNovels(), listPatches()]);
  const covers = [
    ...novels.flatMap((n) => (n.cover ? [{ ...n.cover, href: `/novels/${n.slug}` }] : [])).slice(0, 2),
    ...patches.flatMap((p) => (p.cover ? [{ ...p.cover, href: `/patchs/${p.slug}` }] : [])).slice(0, 1),
  ];
  // La plus récente au centre, les deux autres de part et d’autre.
  const poses = [
    "z-30 rotate-0",
    "z-20 -translate-x-[38%] -rotate-[7deg] scale-90 opacity-90",
    "z-10 translate-x-[38%] rotate-[7deg] scale-90 opacity-90",
  ];
  if (covers.length === 0) return null;
  return (
    <div className="relative mx-auto hidden h-80 w-full max-w-sm items-center justify-center md:flex lg:h-96">
      {covers.map((cover, i) => (
        <Link
          key={cover.href}
          href={cover.href}
          tabIndex={-1}
          className={`absolute aspect-[3/4] h-full overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_60px_rgb(0_0_0/0.55)] transition-transform duration-300 hover:-translate-y-2 ${poses[i]}`}
        >
          <img src={imageUrl(cover)} alt={cover.alt} className="h-full w-full object-cover" />
        </Link>
      ))}
    </div>
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
