import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState, PageIntro } from "@/components/page-intro";
import { excerpt, listNews, newsDate, newsThumbnail } from "@/lib/news";
import { formatDate } from "@/lib/patches";

export const metadata: Metadata = { title: "Actualités" };

export default function NewsPage() {
  return (
    <>
      <PageIntro eyebrow="Actualités" title="Les nouvelles de Saint Eresia">
        Sorties de patchs, nouveaux chapitres et vie de l’équipe.
      </PageIntro>
      <section className="mx-auto max-w-3xl px-4 pt-10 sm:px-6">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
          <NewsList />
        </Suspense>
      </section>
    </>
  );
}

async function NewsList() {
  const news = await listNews({ publishedOnly: true });
  if (news.length === 0) return <EmptyState>Aucune actualité pour le moment.</EmptyState>;
  return (
    <ol className="space-y-4">
      {news.map((item) => {
        const thumbnail = newsThumbnail(item);
        return (
          <li key={item.id}>
            <Link
              href={`/actualites/${item.slug}`}
              className="group flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40 sm:flex-row"
            >
              {thumbnail && (
                <img src={thumbnail} alt="" loading="lazy" className="aspect-video w-full shrink-0 rounded-xl object-cover sm:w-48 sm:self-start" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">
                  <time dateTime={newsDate(item)}>{formatDate(newsDate(item))}</time>
                  {item.author && ` · ${item.author}`}
                </p>
                <h2 className="mt-1.5 text-xl font-extrabold tracking-tight group-hover:text-primary">{item.title}</h2>
                <p className="mt-2 text-muted-foreground">{excerpt(item.content, 260)}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  Lire la suite <ArrowRight className="size-4" />
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
