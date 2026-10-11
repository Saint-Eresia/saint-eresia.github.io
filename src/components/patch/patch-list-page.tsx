import { Suspense } from "react";
import { CardsSkeleton, EmptyState, PageIntro } from "@/components/page-intro";
import { PatchCard } from "@/components/patch/patch-card";
import { PATCH_KINDS, type PatchKind } from "@/lib/patch-kinds";
import { listPatches } from "@/lib/patches";

const INTROS: Record<PatchKind, { title: string; empty: string }> = {
  vn: { title: "Patchs français pour visual novels", empty: "Aucun patch n’est publié pour le moment." },
  jeu: { title: "Patchs français pour jeux vidéo", empty: "Aucun jeu n’est publié pour le moment." },
};

// Liste publique des patchs d’un type : /patchs (visual novels) ou /jeux (autres jeux vidéo).
export function PatchListPage({ kind }: { kind: PatchKind }) {
  return (
    <>
      <PageIntro eyebrow={PATCH_KINDS[kind].plural} title={INTROS[kind].title}>
        Chaque patch contient uniquement la traduction : le jeu original n’est jamais inclus.
      </PageIntro>
      <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <Suspense fallback={<CardsSkeleton />}>
          <PatchGrid kind={kind} />
        </Suspense>
      </section>
    </>
  );
}

async function PatchGrid({ kind }: { kind: PatchKind }) {
  const patches = await listPatches(kind);
  if (patches.length === 0) return <EmptyState>{INTROS[kind].empty}</EmptyState>;
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
      {patches.map((patch) => (
        <PatchCard key={patch.id} patch={patch} />
      ))}
    </div>
  );
}
