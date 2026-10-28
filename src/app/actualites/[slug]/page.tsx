import { ArrowLeft, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { excerpt, getPublishedNews, newsDate, newsThumbnail } from "@/lib/news";
import { formatDate } from "@/lib/patches";
import { socialMetadata } from "@/lib/site-url";
import { getViewer } from "@/lib/viewer";

export async function generateMetadata({ params }: PageProps<"/actualites/[slug]">): Promise<Metadata> {
  const news = await getPublishedNews((await params).slug);
  if (!news) return { title: "Actualité introuvable" };
  // Aperçu de partage : la miniature, sinon la première image de l’article, s’il en a une.
  const image = newsThumbnail(news) ?? news.content.match(/!\[[^\]]*\]\(([^)\s]+)\)/)?.[1];
  return { title: news.title, ...socialMetadata({ title: news.title, description: excerpt(news.content, 160), image, large: !!image, type: "article" }) };
}

export default function NewsArticlePage({ params }: PageProps<"/actualites/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-3xl animate-pulse" />}>
      <NewsArticle params={params} />
    </Suspense>
  );
}

async function NewsArticle({ params }: { params: PageProps<"/actualites/[slug]">["params"] }) {
  const news = await getPublishedNews((await params).slug);
  if (!news) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
      <Link
        href="/actualites"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Actualités
      </Link>
      <header className="mt-6 border-b border-border pb-6">
        <p className="text-sm font-semibold text-muted-foreground">
          <time dateTime={newsDate(news)}>{formatDate(newsDate(news))}</time>
          {news.author && ` · par ${news.author}`}
        </p>
        <h1 className="mt-2 text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl">{news.title}</h1>
        <Suspense fallback={null}>
          <EditLink id={news.id} />
        </Suspense>
      </header>
      <div className="pt-8">
        <Markdown>{news.content}</Markdown>
      </div>
    </article>
  );
}

async function EditLink({ id }: { id: number }) {
  const viewer = await getViewer();
  if (!viewer?.isTeam) return null;
  return (
    <Button asChild variant="outline" size="sm" className="mt-4">
      <Link href={`/gestion/actualites/${id}`}>
        <Pencil /> Modifier
      </Link>
    </Button>
  );
}
