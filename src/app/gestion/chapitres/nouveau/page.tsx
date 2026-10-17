import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ManageHeader, panel } from "@/components/manage-header";
import { TeamGate } from "@/components/team-gate";
import { getVolumeWithNovel, volumeHeading } from "@/lib/novels";
import { ChapterForm } from "../chapter-form";

export const metadata: Metadata = { title: "Nouveau chapitre" };

type Props = PageProps<"/gestion/chapitres/nouveau">;

export default function NewChapterPage({ searchParams }: Props) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <TeamGate>
        <NewChapter searchParams={searchParams} />
      </TeamGate>
    </Suspense>
  );
}

async function NewChapter({ searchParams }: Pick<Props, "searchParams">) {
  const data = await getVolumeWithNovel(Number((await searchParams).tome));
  if (!data) notFound();
  const { volume, novel, volumes, nextPosition } = data;

  return (
    <>
      <ManageHeader back={{ href: `/gestion/novels/${novel.id}`, label: novel.title }} title="Nouveau chapitre" />
      <div className={`mt-8 ${panel}`}>
        <ChapterForm
          novelId={novel.id}
          volumes={volumes.map((v) => ({ id: v.id, heading: volumeHeading(v) }))}
          chapter={{
            volumeId: volume.id,
            label: "",
            title: "",
            position: nextPosition,
            published: false,
            translators: "",
            credits: "",
            downloadUrl: "",
            content: "",
          }}
        />
      </div>
    </>
  );
}
