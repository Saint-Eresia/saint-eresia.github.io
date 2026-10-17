import { ChevronLeft, ChevronRight, Download, List } from "lucide-react";
import type { Metadata } from "next";
import { Literata } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { canSeeNovel, chapterHeading, coverOf, getPublishedChapter, volumeHeading, type ChapterSummary } from "@/lib/novels";
import { imageUrl } from "@/lib/patches";
import { socialMetadata } from "@/lib/site-url";
import { ReaderPanel } from "./reader-panel";

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

  return (
    <article className={`mx-auto max-w-3xl px-4 pt-10 sm:px-6 ${literata.variable}`}>
      <header className="text-center">
        <Link href={`/novels/${novel.slug}`} className="text-sm font-semibold text-primary hover:underline">
          {novel.title}
        </Link>
        <p className="mt-1 text-sm text-muted-foreground">{volumeHeading(volume)}</p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{chapterHeading(chapter)}</h1>
        {chapter.translators && <p className="mt-3 text-sm text-muted-foreground">Traduction : {chapter.translators}</p>}
        {chapter.downloadUrl && (
          <Button asChild variant="outline" size="pill" className="mt-5">
            <a href={chapter.downloadUrl} target="_blank" rel="noopener noreferrer">
              <Download /> Télécharger
            </a>
          </Button>
        )}
      </header>

      <ChapterNav novelSlug={novel.slug} previous={previous} next={next} className="mt-8" />
      <div className="mt-10">
        <ReaderPanel
          images={imagesOf(chapter.content)}
          novelSlug={novel.slug}
          chapter={{ slug: chapter.slug, heading: chapterHeading(chapter) }}
          previousHref={previous && `/novels/${novel.slug}/${previous.slug}`}
          nextHref={next && `/novels/${novel.slug}/${next.slug}`}
        >
          <Markdown reader>{chapter.content}</Markdown>
        </ReaderPanel>
      </div>
      <ChapterNav novelSlug={novel.slug} previous={previous} next={next} className="mt-14 border-t border-border pt-8" />
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
