import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Dropzone } from "@/components/dropzone";
import { ManageHeader, panel } from "@/components/manage-header";
import { TeamEditor } from "@/components/team-editor";
import { TeamGate } from "@/components/team-gate";
import { Button } from "@/components/ui/button";
import { chapterHeading, getNovelById, NOVEL_STATUSES } from "@/lib/novels";
import { imageUrl } from "@/lib/patches";
import { NOVEL_ROLES } from "@/lib/roles";
import { listNovelTeam, listTeam } from "@/lib/team";
import { saveNovelTeam } from "../actions";
import { DeleteNovelImageButton } from "../delete-background-button";
import { DeleteNovelButton } from "../delete-novel-button";
import { NovelForm } from "../novel-form";
import { fileUrl } from "@/lib/file-url";
import { VolumeManager } from "../volume-manager";

export const metadata: Metadata = { title: "Modifier un novel" };

type Props = PageProps<"/gestion/novels/[id]">;

export default function EditNovelPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <TeamGate>
        <EditNovel params={params} searchParams={searchParams} />
      </TeamGate>
    </Suspense>
  );
}

async function EditNovel({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const novel = await getNovelById(Number((await params).id));
  if (!novel) notFound();
  const created = (await searchParams).cree === "1";

  return (
    <>
      <ManageHeader
        back={{ href: "/gestion?onglet=novels", label: "Gestion" }}
        title={novel.title}
        created={created && "Novel créé. Ajoutez maintenant sa couverture et ses tomes."}
        actions={
          <Button asChild variant="outline" size="pill">
            <Link href={`/novels/${novel.slug}`}>
              Voir la fiche publique <ExternalLink />
            </Link>
          </Button>
        }
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className={panel} aria-label="Informations du novel">
          <NovelForm
            statuses={NOVEL_STATUSES}
            novel={{
              id: novel.id,
              title: novel.title,
              originalTitle: novel.originalTitle,
              author: novel.author,
              artist: novel.artist,
              status: novel.status,
              synopsis: novel.synopsis,
              quote: novel.quote,
              quoteNote: novel.quoteNote,
              format: novel.format,
              released: novel.released,
              featured: novel.featured ? "1" : "0",
              draft: novel.draft ? "1" : "0",
            }}
          />
        </section>
        <section className={`${panel} space-y-10 self-start`} aria-label="Images du novel">
          <div className="space-y-3">
            <h2 className="text-lg font-extrabold">Couverture</h2>
            {novel.cover && (
              <img
                src={imageUrl(novel.cover)}
                alt={novel.cover.alt}
                className="aspect-[3/4] w-40 rounded-lg border border-border object-cover"
              />
            )}
            <Dropzone
              endpoint={`/api/novels/${novel.id}/images`}
              kind="cover"
              label={novel.cover ? "Remplacer la couverture" : "Ajouter une couverture"}
            />
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-extrabold">Arrière-plan</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Image large affichée derrière le titre de la fiche (une illustration en paysage). Sans arrière-plan, la
                couverture floutée est utilisée.
              </p>
            </div>
            {novel.background && (
              <div className="space-y-2">
                <img
                  src={imageUrl(novel.background)}
                  alt={novel.background.alt}
                  className="aspect-[16/6] w-full rounded-lg border border-border object-cover"
                />
                <DeleteNovelImageButton novelId={novel.id} kind="background" />
              </div>
            )}
            <Dropzone
              endpoint={`/api/novels/${novel.id}/images`}
              kind="background"
              label={novel.background ? "Remplacer l’arrière-plan" : "Ajouter un arrière-plan"}
            />
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-extrabold">Logo</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Affiché à droite dans le carrousel « Recommandé » de l’accueil. Utilisez un PNG à fond transparent
                (logo du titre ou personnage détouré).
              </p>
            </div>
            {novel.logo && (
              <div className="space-y-2">
                {/* Damier : la transparence du logo reste visible. */}
                <div className="grid h-40 place-items-center rounded-lg border border-border bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:20px_20px] p-3">
                  <img src={imageUrl(novel.logo)} alt={novel.logo.alt} className="max-h-full max-w-full object-contain" />
                </div>
                <DeleteNovelImageButton novelId={novel.id} kind="logo" />
              </div>
            )}
            <Dropzone
              endpoint={`/api/novels/${novel.id}/images`}
              kind="logo"
              label={novel.logo ? "Remplacer le logo" : "Ajouter un logo"}
            />
          </div>
        </section>
      </div>

      <section className={`mt-8 ${panel}`}>
        <h2 className="mb-5 text-lg font-extrabold">Tomes et chapitres</h2>
        <VolumeManager
          novelId={novel.id}
          volumes={novel.volumes.map((volume) => ({
            id: volume.id,
            number: volume.number,
            label: volume.label,
            title: volume.title,
            note: volume.note,
            image: volume.image && fileUrl(volume.image),
            imageCredit: volume.imageCredit,
            chapters: volume.chapters.map((c) => ({ id: c.id, heading: chapterHeading(c), published: c.published === 1 })),
          }))}
        />
      </section>

      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-2xl bg-muted" />}>
        <NovelTeamSection novelId={novel.id} />
      </Suspense>

      <section className="mt-10 rounded-2xl border border-destructive/30 p-6">
        <h2 className="text-lg font-extrabold text-destructive">Zone de danger</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">La suppression est définitive.</p>
        <DeleteNovelButton novelId={novel.id} title={novel.title} />
      </section>
    </>
  );
}

// Équipe du novel : tableau membres × rôles (rôles adaptés aux light novels). Affichée sur la fiche et la page Équipe.
async function NovelTeamSection({ novelId }: { novelId: number }) {
  const [team, novelTeam] = await Promise.all([listTeam(), listNovelTeam(novelId)]);
  return (
    <section id="equipe-novel" className="mt-8 scroll-mt-24 rounded-2xl border border-border bg-card p-6 sm:p-8" aria-labelledby="equipe-novel-titre">
      <h2 id="equipe-novel-titre" className="text-lg font-extrabold">
        Équipe du novel
      </h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        Ajoutez les membres qui ont participé et cochez leurs rôles sur ce novel. Ils apparaissent sur la fiche publique
        et sur la page Équipe.
      </p>
      <TeamEditor
        project="novel"
        roles={NOVEL_ROLES}
        team={team.map((member) => ({ id: member.id, name: member.name, avatarFile: member.avatarFile }))}
        initial={novelTeam.map((member) => ({ memberId: member.id, roles: member.roles }))}
        save={saveNovelTeam.bind(null, novelId)}
      />
    </section>
  );
}
