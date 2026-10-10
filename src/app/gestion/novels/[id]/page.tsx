import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Dropzone } from "@/components/dropzone";
import { ManageHeader, panel } from "@/components/manage-header";
import { TeamGate } from "@/components/team-gate";
import { Button } from "@/components/ui/button";
import { chapterHeading, getNovelById, NOVEL_STATUSES } from "@/lib/novels";
import { imageUrl } from "@/lib/patches";
import { DeleteNovelButton } from "../delete-novel-button";
import { NovelForm } from "../novel-form";
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
        back={{ href: "/gestion", label: "Gestion" }}
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
            }}
          />
        </section>
        <section className={`${panel} space-y-3 self-start`}>
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
        </section>
      </div>

      <section className={`mt-8 ${panel}`}>
        <h2 className="mb-5 text-lg font-extrabold">Tomes et chapitres</h2>
        <VolumeManager
          novelId={novel.id}
          volumes={novel.volumes.map((volume) => ({
            id: volume.id,
            number: volume.number,
            title: volume.title,
            chapters: volume.chapters.map((c) => ({ id: c.id, heading: chapterHeading(c), published: c.published === 1 })),
          }))}
        />
      </section>

      <section className="mt-10 rounded-2xl border border-destructive/30 p-6">
        <h2 className="text-lg font-extrabold text-destructive">Zone de danger</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">La suppression est définitive.</p>
        <DeleteNovelButton novelId={novel.id} title={novel.title} />
      </section>
    </>
  );
}
