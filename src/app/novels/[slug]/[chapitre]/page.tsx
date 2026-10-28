import { ChevronLeft, ChevronRight, Download, List } from "lucide-react";
import type { Metadata } from "next";
import { Literata } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CreditLines } from "@/components/credit-lines";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { canSeeNovel, chapterHeading, coverOf, getNovelBySlug, getPublishedChapter, volumeHeading, type ChapterSummary } from "@/lib/novels";
import { imageUrl } from "@/lib/patches";
import { socialMetadata } from "@/lib/site-url";
import { ReaderPanel } from "./reader-panel";
import { TypoReport } from "./typo-report";

// Police serif proposée dans les options de lecture.
const literata = Literata({ variable: "--font-literata", subsets: ["latin"] });

// Illustrations du chapitre, dans l’ordre du texte, pour la liste du panneau de lecture.
const imagesOf = (content: string) =>
  [...content.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)].map(([, alt, src]) => ({ alt, src }));

type Props = PageProps<"/novels/[slug]/[chapitre]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, chapitre } = await params;
  const data = await getPublishedChapter(slug, chapitre);
  if (!data || !(await canSeeNovel(data.novel))) return { title: "Chapitre introuvable" };
  const title = `${chapterHeading(data.chapter)} · ${data.novel.title}`;
  const cover = await coverOf(data.novel.id);
  return {
    title,
    ...socialMetadata({
      title,
      description: `${data.novel.title}, ${volumeHeading(data.volume)} : ${chapterHeading(data.chapter)}. À lire en ligne en français sur Saint Eresia.`,
      image: cover && imageUrl(cover),
      type: "article",
    }),
  };
}

export default function ReaderPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-3xl animate-pulse" />}>
      <Reader params={params} />
    </Suspense>
  );
}

async function Reader({ params }: { params: Props["params"] }) {
  const { slug, chapitre } = await params;
  const data = await getPublishedChapter(slug, chapitre);
  // Chapitre d’un novel en brouillon : réservé à l’équipe.
  if (!data || !(await canSeeNovel(data.novel))) notFound();
  const { novel, volume, chapter, previous, next } = data;
  // Sommaire du mode lecture : tous les chapitres publiés du novel, par tome.
  const toc = ((await getNovelBySlug(slug))?.volumes ?? []).map((v) => ({
    heading: volumeHeading(v),
    chapters: v.chapters.map((c) => ({ slug: c.slug, heading: chapterHeading(c) })),
  }));

  const credits = chapter.credits ? (
    <CreditLines text={chapter.credits} className="space-y-0.5" />
  ) : (
    chapter.translators && <p>Traduction : {chapter.translators}</p>
  );

  return (
    <article className={`reader-article mx-auto max-w-3xl px-4 pt-10 sm:px-6 ${literata.variable}`}>
      <header className="text-center">
        <Link href={`/novels/${novel.slug}`} data-reader-chrome className="text-sm font-semibold text-primary hover:underline">
          {novel.title}
        </Link>
        <p data-reader-chrome className="mt-1 text-sm text-muted-foreground">
          {volumeHeading(volume)}
        </p>
        {/* En capitales, avec la police de lecture : « Chapitre 1 – « Titre » ». Les traducteurs apparaissent au survol
            du titre (au toucher sur mobile, qui lui donne le focus) ; la bulle touche le titre pour qu'on puisse y suivre un lien. */}
        <div className="group relative mt-5 lg:-mx-8">
          <h1
            tabIndex={credits ? 0 : undefined}
            aria-describedby={credits ? "chapter-credits" : undefined}
            className={`font-(family-name:--font-literata) text-2xl leading-snug font-normal tracking-wide text-pretty uppercase outline-none sm:text-4xl sm:leading-snug ${credits ? "cursor-help" : ""}`}
          >
            {chapter.title && chapter.title !== chapter.label ? `${chapter.label} – « ${chapter.title} »` : chapter.label}
          </h1>
          {credits && (
            <div
              id="chapter-credits"
              className="invisible absolute inset-x-0 top-full z-20 flex justify-center pt-2 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
            >
              <div className="max-w-xl rounded-xl border border-border bg-popover px-4 py-3 text-sm text-muted-foreground shadow-[0_12px_32px_var(--shadow)]">
                {credits}
              </div>
            </div>
          )}
        </div>
        {chapter.downloadUrl && (
          <Button asChild variant="outline" size="pill" className="mt-5">
            <a href={chapter.downloadUrl} target="_blank" rel="noopener noreferrer">
              <Download /> Télécharger
            </a>
          </Button>
        )}
      </header>

      <div data-reader-chrome>
        <ChapterNav novelSlug={novel.slug} previous={previous} next={next} className="mt-8" />
      </div>
      <div className="mt-10">
        <ReaderPanel
          images={imagesOf(chapter.content)}
          novelSlug={novel.slug}
          chapter={{ slug: chapter.slug, heading: chapterHeading(chapter) }}
          previousHref={previous && `/novels/${novel.slug}/${previous.slug}`}
          nextHref={next && `/novels/${novel.slug}/${next.slug}`}
          toc={toc}
        >
          <Markdown reader>{chapter.content}</Markdown>
        </ReaderPanel>
      </div>
      <div className="mt-12">
        <TypoReport novelSlug={novel.slug} chapterSlug={chapter.slug} />
      </div>
      <ChapterNav novelSlug={novel.slug} previous={previous} next={next} className="mt-6 border-t border-border pt-8" />
    </article>
  );
}

function ChapterNav({
  novelSlug,
  previous,
  next,
  className,
}: {
  novelSlug: string;
  previous: ChapterSummary | null;
  next: ChapterSummary | null;
  className?: string;
}) {
  return (
    <nav aria-label="Navigation entre les chapitres" className={`grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 ${className}`}>
      <div>
        {previous && (
          <Button asChild variant="outline" size="pill" className="max-w-full">
            <Link href={`/novels/${novelSlug}/${previous.slug}`} title={chapterHeading(previous)}>
              <ChevronLeft /> <span className="truncate max-sm:sr-only">{previous.label}</span>
              <span className="sm:sr-only">Précédent</span>
            </Link>
          </Button>
        )}
      </div>
      <Button asChild variant="ghost" size="pill">
        <Link href={`/novels/${novelSlug}`}>
          <List /> <span className="max-sm:sr-only">Sommaire</span>
        </Link>
      </Button>
      <div className="text-right">
        {next && (
          <Button asChild size="pill" className="max-w-full">
            <Link href={`/novels/${novelSlug}/${next.slug}`} title={chapterHeading(next)}>
              <span className="truncate max-sm:sr-only">{next.label}</span>
              <span className="sm:sr-only">Suivant</span> <ChevronRight />
            </Link>
          </Button>
        )}
      </div>
    </nav>
  );
}
