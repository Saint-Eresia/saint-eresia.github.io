import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TeamGate } from "@/components/team-gate";
import { PATCH_KINDS, type PatchKind } from "@/lib/patch-kinds";
import { STATUSES } from "@/lib/patches";
import { PatchForm } from "../patch-form";

export const metadata: Metadata = { title: "Nouveau patch" };

// ?type=jeu : le formulaire s’ouvre sur la rubrique Jeux (bouton « Nouveau jeu » de la gestion).
export default function NewPatchPage({ searchParams }: PageProps<"/gestion/patchs/nouveau">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <TeamGate>
        <NewPatch searchParams={searchParams} />
      </TeamGate>
    </Suspense>
  );
}

async function NewPatch({ searchParams }: Pick<PageProps<"/gestion/patchs/nouveau">, "searchParams">) {
  const kind: PatchKind = (await searchParams).type === "jeu" ? "jeu" : "vn";
  return (
    <>
      <Link
        href={`/gestion?onglet=${PATCH_KINDS[kind].tab}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Gestion des {kind === "jeu" ? "jeux" : "patchs"}
      </Link>
      <h1 className="mt-4 mb-8 text-3xl font-extrabold tracking-tight">{kind === "jeu" ? "Nouveau jeu" : "Nouveau patch"}</h1>
      <div className="max-w-3xl rounded-2xl border border-border bg-card p-6 sm:p-8">
        <PatchForm
          statuses={STATUSES}
          patch={{ title: "", description: "", status: "En développement", progress: 0, downloadUrl: "", steamAppId: null, gogId: null, vndbId: "", youtubeId: "", steps: [], quote: "", featured: false, draft: true, kind }}
        />
        <p className="mt-6 text-sm text-muted-foreground">
          Vous pourrez ajouter la couverture et les captures d’écran une fois le {kind === "jeu" ? "jeu" : "patch"} créé.
        </p>
      </div>
    </>
  );
}
