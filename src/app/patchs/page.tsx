import type { Metadata } from "next";
import { Suspense } from "react";
import { CardsSkeleton, EmptyState, PageIntro } from "@/components/page-intro";
import { PatchCard } from "@/components/patch/patch-card";
import { listPatches } from "@/lib/patches";

export const metadata: Metadata = { title: "Patchs VN" };

export default function PatchesPage() {
  return (
    <>
      <PageIntro eyebrow="Patchs VN" title="Patchs français pour visual novels">
        Chaque patch contient uniquement la traduction : le jeu original n’est jamais inclus.
      </PageIntro>
      <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <Suspense fallback={<CardsSkeleton />}>
          <PatchGrid />
        </Suspense>
      </section>
    </>
  );
}

async function PatchGrid() {
  const patches = await listPatches();
  if (patches.length === 0) return <EmptyState>Aucun patch n’est publié pour le moment.</EmptyState>;
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      {patches.map((patch) => (
        <PatchCard key={patch.id} patch={patch} />
      ))}
    </div>
  );
}
