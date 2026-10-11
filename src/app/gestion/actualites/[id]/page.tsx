import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ManageHeader, panel } from "@/components/manage-header";
import { TeamGate } from "@/components/team-gate";
import { Button } from "@/components/ui/button";
import { getNewsById } from "@/lib/news";
import { formatDate } from "@/lib/patches";
import { DeleteNewsButton } from "../delete-news-button";
import { NewsForm } from "../news-form";

export const metadata: Metadata = { title: "Modifier une actualité" };

type Props = PageProps<"/gestion/actualites/[id]">;

export default function EditNewsPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <TeamGate>
        <EditNews params={params} searchParams={searchParams} />
      </TeamGate>
    </Suspense>
  );
}

async function EditNews({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const news = await getNewsById(Number((await params).id));
  if (!news) notFound();
  const created = (await searchParams).cree === "1";

  return (
    <>
      <ManageHeader
        back={{ href: "/gestion", label: "Gestion" }}
        title={news.title}
        created={created && "Actualité créée. Passez-la en « Publiée » pour l’afficher sur l’accueil."}
        actions={
          news.published === 1 && (
            <Button asChild variant="outline" size="pill">
              <Link href={`/actualites/${news.slug}`}>
                Voir l’actualité <ExternalLink />
              </Link>
            </Button>
          )
        }
      />
      <p className="mt-3 text-sm text-muted-foreground">
        {news.published === 1 && news.publishedAt ? `Publiée le ${formatDate(news.publishedAt)}` : "Brouillon"}
        {news.author && ` · par ${news.author}`}
      </p>

      <div className={`mt-8 max-w-4xl ${panel}`}>
        <NewsForm news={{ id: news.id, title: news.title, content: news.content, published: news.published === 1 }} />
      </div>

      <section className="mt-10 max-w-4xl rounded-2xl border border-destructive/30 p-6">
        <h2 className="text-lg font-extrabold text-destructive">Zone de danger</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">La suppression est définitive.</p>
        <DeleteNewsButton newsId={news.id} title={news.title} />
      </section>
    </>
  );
}
