import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ManageHeader, panel } from "@/components/manage-header";
import { TeamGate } from "@/components/team-gate";
import { Button } from "@/components/ui/button";
import { chapterHeading, getChapterById, volumeHeading } from "@/lib/novels";
import { DeleteChapterButton } from "../../novels/delete-novel-button";
import { ChapterForm } from "../chapter-form";

export const metadata: Metadata = { title: "Modifier un chapitre" };

type Props = PageProps<"/gestion/chapitres/[id]">;

export default function EditChapterPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <TeamGate>
        <EditChapter params={params} searchParams={searchParams} />
      </TeamGate>
    </Suspense>
  );
}

async function EditChapter({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const data = await getChapterById(Number((await params).id));
  if (!data) notFound();
  const { chapter, novel, volumes } = data;
  const created = (await searchParams).cree === "1";

  return (
    <>
      <ManageHeader
        back={{ href: `/gestion/novels/${novel.id}`, label: novel.title }}
        title={chapterHeading(chapter)}
        created={created && (chapter.published ? "Chapitre créé et publié." : "Chapitre créé en brouillon.")}
        actions={
          chapter.published ? (
            <Button asChild variant="outline" size="pill">
              <Link href={`/novels/${novel.slug}/${chapter.slug}`}>
                Lire en ligne <ExternalLink />
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className={`mt-8 ${panel}`}>
        <ChapterForm
          novelId={novel.id}
          volumes={volumes.map((v) => ({ id: v.id, heading: volumeHeading(v) }))}
          chapter={{
            id: chapter.id,
            volumeId: chapter.volumeId,
            label: chapter.label,
            title: chapter.title,
            position: chapter.position,
            published: chapter.published === 1,
            translators: chapter.translators,
            downloadUrl: chapter.downloadUrl,
            content: chapter.content,
          }}
        />
      </div>
      <section className="mt-10 rounded-2xl border border-destructive/30 p-6">
        <h2 className="text-lg font-extrabold text-destructive">Zone de danger</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">La suppression est définitive.</p>
        <DeleteChapterButton chapterId={chapter.id} heading={chapterHeading(chapter)} />
      </section>
    </>
  );
}
