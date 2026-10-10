import type { Metadata } from "next";
import { Suspense } from "react";
import { NovelCard } from "@/components/novel-card";
import { CardsSkeleton, EmptyState, PageIntro } from "@/components/page-intro";
import { listNovels } from "@/lib/novels";

export const metadata: Metadata = { title: "Light novels" };

export default function NovelsPage() {
  return (
    <>
      <PageIntro eyebrow="Light novels" title="Catalogue des novels">
        Des light novels traduits en français, à lire directement sur le site.
      </PageIntro>
      <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <Suspense fallback={<CardsSkeleton />}>
          <NovelGrid />
        </Suspense>
      </section>
    </>
  );
}

async function NovelGrid() {
  const novels = await listNovels();
  if (novels.length === 0) return <EmptyState>Aucun light novel pour le moment.</EmptyState>;
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      {novels.map((novel) => (
        <NovelCard key={novel.id} novel={novel} />
      ))}
    </div>
  );
}
