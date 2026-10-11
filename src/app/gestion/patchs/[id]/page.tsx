import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PatchTeamEditor } from "@/components/patch-team-editor";
import { TeamGate } from "@/components/team-gate";
import { Button } from "@/components/ui/button";
import { getPatchById, imageUrl, STATUSES, type PatchImage } from "@/lib/patches";
import { listPatchTeam, listTeam } from "@/lib/team";
import { savePatchTeam } from "../actions";
import { DeletePatchButton } from "../delete-patch-button";
import { ImageManager, type ManagedImage } from "../image-manager";
import { PatchForm } from "../patch-form";

export const metadata: Metadata = { title: "Modifier un patch" };

const toManaged = (image: PatchImage): ManagedImage => ({
  id: image.id,
  src: imageUrl(image),
  alt: image.alt,
  width: image.width,
  height: image.height,
});

export default function EditPatchPage({ params, searchParams }: PageProps<"/gestion/patchs/[id]">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <TeamGate>
        <EditPatch params={params} searchParams={searchParams} />
      </TeamGate>
    </Suspense>
  );
}

async function EditPatch({ params, searchParams }: Pick<PageProps<"/gestion/patchs/[id]">, "params" | "searchParams">) {
  const patch = await getPatchById(Number((await params).id));
  if (!patch) notFound();
  const justCreated = (await searchParams).cree === "1";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link href="/gestion" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-4" /> Gestion des patchs
          </Link>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-balance">{patch.title}</h1>
        </div>
        <Button asChild variant="outline" size="pill">
          <Link href={`/patchs/${patch.slug}`}>
            Voir la fiche publique <ExternalLink />
          </Link>
        </Button>
      </div>
      {justCreated && (
        <p role="status" className="mt-5 rounded-xl border border-success/30 bg-success/10 px-4 py-3 text-sm">
          Patch créé. Ajoutez maintenant sa couverture et ses captures d’écran.
        </p>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8" aria-label="Informations du patch">
          <PatchForm
            statuses={STATUSES}
            patch={{
              id: patch.id,
              title: patch.title,
              description: patch.description,
              status: patch.status,
              progress: patch.progress,
              downloadUrl: patch.downloadUrl,
              steps: patch.steps,
              quote: patch.quote,
              featured: patch.featured === 1,
            }}
          />
        </section>
        <section className="rounded-2xl border border-border bg-card p-6 sm:p-8" aria-label="Images du patch">
          <ImageManager
            patchId={patch.id}
            cover={patch.cover ? toManaged(patch.cover) : null}
            background={patch.background ? toManaged(patch.background) : null}
            logo={patch.logo ? toManaged(patch.logo) : null}
            screenshots={patch.screenshots.map(toManaged)}
          />
        </section>
      </div>

      <PatchTeamSection patchId={patch.id} />

      <section className="mt-10 rounded-2xl border border-destructive/30 p-6">
        <h2 className="text-lg font-extrabold text-destructive">Zone de danger</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">La suppression est définitive.</p>
        <DeletePatchButton patchId={patch.id} title={patch.title} />
      </section>
    </>
  );
}

// Équipe du patch : tableau membres × rôles (liste fixe). Affichée sur la fiche du patch et la page Équipe.
async function PatchTeamSection({ patchId }: { patchId: number }) {
  const [team, patchTeam] = await Promise.all([listTeam(), listPatchTeam(patchId)]);
  return (
    <section id="equipe-patch" className="mt-8 scroll-mt-24 rounded-2xl border border-border bg-card p-6 sm:p-8" aria-labelledby="equipe-patch-titre">
      <h2 id="equipe-patch-titre" className="text-lg font-extrabold">
        Équipe du patch
      </h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        Ajoutez les membres qui ont participé et cochez leurs rôles sur ce patch. Ils apparaissent sur la fiche publique
        et sur la page Équipe.
      </p>
      <PatchTeamEditor
        team={team.map((member) => ({ id: member.id, name: member.name, avatarFile: member.avatarFile }))}
        initial={patchTeam.map((member) => ({ memberId: member.id, roles: member.roles }))}
        save={savePatchTeam.bind(null, patchId)}
      />
    </section>
  );
}
