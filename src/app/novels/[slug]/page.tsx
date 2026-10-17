import { ArrowLeft, BookOpen, ChevronRight, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CoverPlaceholder, StatusBadge } from "@/components/content-meta";
import { HeroBackdrop } from "@/components/hero-backdrop";
import { Markdown } from "@/components/markdown";
import { projectLayout } from "@/components/project-layout";
import { ProjectMembers } from "@/components/project-members";
import { Button } from "@/components/ui/button";
import { canSeeNovel, chapterHeading, getNovelBySlug, isPublicNovel, volumeHeading, type ChapterSummary, type VolumeWithChapters } from "@/lib/novels";
import { formatDate, imageUrl } from "@/lib/patches";
import { listNovelTeam } from "@/lib/team";
import { getViewer } from "@/lib/viewer";

export async function generateMetadata({ params }: PageProps<"/novels/[slug]">): Promise<Metadata> {
  const novel = await getNovelBySlug((await params).slug);
  if (!novel || !(await canSeeNovel(novel))) return { title: "Light novel introuvable" };
  return isPublicNovel(novel) ? { title: novel.title } : { title: `${novel.title} (brouillon)`, robots: { index: false } };
}

export default function NovelPage({ params }: PageProps<"/novels/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-6xl animate-pulse" />}>
      <NovelDetail params={params} />
    </Suspense>
  );
}

async function NovelDetail({ params }: { params: PageProps<"/novels/[slug]">["params"] }) {
  const novel = await getNovelBySlug((await params).slug);
  if (!novel || !(await canSeeNovel(novel))) notFound();
  const first = novel.volumes[0]?.chapters[0];
  const chapterCount = novel.volumes.reduce((total, volume) => total + volume.chapters.length, 0);
  const facts = [
    ["Titre original", novel.originalTitle],
    ["Auteur", novel.author],
    ["Illustrateur", novel.artist],
    ["Chapitres publiés", String(chapterCount)],
  ].filter(([, value]) => value);
  const members = await listNovelTeam(novel.id);
  const layout = projectLayout(members.length > 0);

  return (
    <article>
      <header className="relative isolate overflow-hidden border-b border-border">
        <HeroBackdrop
          background={novel.background && imageUrl(novel.background)}
          cover={novel.cover && imageUrl(novel.cover)}
        />
        <div className={layout.hero}>
          <Link
            href="/novels"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Novels
          </Link>
          {!isPublicNovel(novel) && (
            <p role="status" className="mt-4 w-fit rounded-xl border border-warning/40 bg-warning/10 px-4 py-2 text-sm font-semibold text-warning">
              Brouillon : ce novel n’est visible que par l’équipe.
            </p>
          )}
          <div className="mt-8 grid gap-8 sm:grid-cols-[13rem_1fr] sm:items-end md:grid-cols-[15rem_1fr]">
            <div className="aspect-[3/4] w-40 overflow-hidden rounded-2xl border border-border shadow-[0_24px_60px_var(--shadow)] sm:w-full">
              {novel.cover ? (
                <img
                  src={imageUrl(novel.cover)}
                  alt={novel.cover.alt}
                  width={novel.cover.width}
                  height={novel.cover.height}
                  className="h-full w-full object-cover"
                />
              ) : (
                <CoverPlaceholder title={novel.title} />
              )}
            </div>
            <div className="min-w-0 pb-2">
              <StatusBadge status={novel.status} />
              <h1 className="mt-3 text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl lg:text-5xl">
                {novel.title}
              </h1>
              {novel.author && <p className="mt-3 text-muted-foreground">par {novel.author}</p>}
            </div>
          </div>
        </div>
      </header>

      <div className={layout.body}>
        <aside className={layout.aside}>
          <div className={`space-y-5 rounded-2xl border border-border bg-card p-6 ${layout.sticky}`}>
            {first ? (
              <Button asChild size="pill" className="w-full">
                <Link href={`/novels/${novel.slug}/${first.slug}`}>
                  <BookOpen /> Commencer la lecture
                </Link>
              </Button>
            ) : (
              <Button size="pill" className="w-full" disabled>
                Bientôt disponible
              </Button>
            )}
            <dl className="divide-y divide-border text-sm">
              {facts.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <Suspense fallback={null}>
              <EditLink id={novel.id} />
            </Suspense>
          </div>
        </aside>

        {members.length > 0 && (
          <aside className={layout.members}>
            <ProjectMembers members={members} className="2xl:sticky 2xl:top-24" />
          </aside>
        )}

        <div className={`space-y-12 ${layout.content}`}>
          {novel.synopsis && (
            <section>
              <h2 className="sr-only">Présentation</h2>
              <Markdown>{novel.synopsis}</Markdown>
            </section>
          )}

          <section>
            <h2 className="mb-5 text-xl font-extrabold tracking-tight">Sommaire</h2>
            {novel.volumes.length === 0 ? (
              <p className="text-muted-foreground">Aucun chapitre publié pour le moment.</p>
            ) : (
              <div className="space-y-5">
                {tableOfContents(novel.volumes).map((group) => (
                  <div key={group.key} className="overflow-hidden rounded-2xl border border-border bg-card">
                    {group.heading && <h3 className="border-b border-border bg-secondary px-5 py-3 font-bold">{group.heading}</h3>}
                    {group.note && (
                      <div className="border-b border-border bg-secondary/50 px-5 py-3 text-sm">
                        <Markdown>{group.note}</Markdown>
                      </div>
                    )}
                    <ol className="divide-y divide-border">
                      {group.rows.map(({ chapter, heading }) => (
                        <li key={chapter.id}>
                          <Link
                            href={`/novels/${novel.slug}/${chapter.slug}`}
                            className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/50"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block font-semibold group-hover:text-primary">
                                <span aria-hidden className="mr-1.5 text-primary">•</span>
                                {heading}
                              </span>
                              {chapter.translators && (
                                <span className="block text-xs text-muted-foreground">Traduction : {chapter.translators}</span>
                              )}
                            </span>
                            <span className="hidden text-xs text-muted-foreground sm:block">{formatDate(chapter.updatedAt)}</span>
                            <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary" />
                          </Link>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </article>
  );
}

// Un tome lu d’un bloc (un seul chapitre « Tome N ») n’a pas besoin d’en-tête :
// ces tomes consécutifs sont regroupés dans une même liste.
function tableOfContents(volumes: VolumeWithChapters[]) {
  const groups: { key: string; heading: string | null; note?: string; rows: { chapter: ChapterSummary; heading: string }[] }[] = [];
  for (const volume of volumes) {
    const [only] = volume.chapters;
    const whole = volume.chapters.length === 1 && only.label === `Tome ${volume.number}`;
    if (!whole) {
      groups.push({
        key: `v${volume.id}`,
        heading: volumeHeading(volume),
        note: volume.note,
        rows: volume.chapters.map((chapter) => ({ chapter, heading: chapterHeading(chapter) })),
      });
      continue;
    }
    const row = { chapter: only, heading: only.title ? `${volumeHeading(volume)} — ${only.title}` : volumeHeading(volume) };
    const last = groups.at(-1);
    if (last && last.heading === null) last.rows.push(row);
    else groups.push({ key: `t${volume.id}`, heading: null, rows: [row] });
  }
  return groups;
}

async function EditLink({ id }: { id: number }) {
  const viewer = await getViewer();
  if (!viewer?.isTeam) return null;
  return (
    <Button asChild variant="outline" size="pill" className="w-full">
      <Link href={`/gestion/novels/${id}`}>
        <Pencil /> Modifier
      </Link>
    </Button>
  );
}
