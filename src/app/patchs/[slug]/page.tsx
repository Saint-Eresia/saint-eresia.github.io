import { ArrowLeft, Download, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Gallery } from "@/components/patch/gallery";
import { Markdown } from "@/components/markdown";
import { CoverPlaceholder, ProgressBar, StatusBadge } from "@/components/content-meta";
import { Button } from "@/components/ui/button";
import { formatDate, getPatchBySlug, imageUrl } from "@/lib/patches";
import { getViewer } from "@/lib/viewer";

export async function generateMetadata({ params }: PageProps<"/patchs/[slug]">): Promise<Metadata> {
  const patch = await getPatchBySlug((await params).slug);
  return { title: patch?.title ?? "Patch introuvable" };
}

export default function PatchPage({ params }: PageProps<"/patchs/[slug]">) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-6xl animate-pulse" />}>
      <PatchDetail params={params} />
    </Suspense>
  );
}

async function PatchDetail({ params }: { params: PageProps<"/patchs/[slug]">["params"] }) {
  const patch = await getPatchBySlug((await params).slug);
  if (!patch) notFound();

  return (
    <article>
      <header className="relative isolate overflow-hidden border-b border-border">
        {patch.cover && (
          <img
            src={imageUrl(patch.cover)}
            alt=""
            className="absolute inset-0 -z-20 h-full w-full scale-110 object-cover opacity-30 blur-3xl saturate-150"
          />
        )}
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-background/40 to-background" />
        <div className="mx-auto max-w-6xl px-4 pt-8 pb-12 sm:px-6">
          <Link
            href="/patchs"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Patchs VN
          </Link>
          <div className="mt-8 grid gap-8 sm:grid-cols-[13rem_1fr] sm:items-end md:grid-cols-[15rem_1fr]">
            <div className="aspect-[3/4] w-40 overflow-hidden rounded-2xl border border-white/10 shadow-[0_24px_60px_rgb(0_0_0/0.55)] sm:w-full">
              {patch.cover ? (
                <img
                  src={imageUrl(patch.cover)}
                  alt={patch.cover.alt}
                  width={patch.cover.width}
                  height={patch.cover.height}
                  className="h-full w-full object-cover"
                />
              ) : (
                <CoverPlaceholder title={patch.title} />
              )}
            </div>
            <div className="min-w-0 pb-2">
              <StatusBadge status={patch.status} />
              <h1 className="mt-3 text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl lg:text-5xl">
                {patch.title}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">Mis à jour le {formatDate(patch.updatedAt)}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <aside className="lg:order-last">
          <div className="space-y-5 rounded-2xl border border-border bg-card p-6 lg:sticky lg:top-24">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-muted-foreground">Avancement</span>
                <span className="text-2xl font-extrabold tabular-nums">{patch.progress} %</span>
              </div>
              <ProgressBar value={patch.progress} className="mt-2 h-2" />
              {patch.steps.length > 0 && (
                <dl className="mt-5 space-y-3.5 border-t border-border pt-4">
                  {patch.steps.map((step) => (
                    <div key={step.label}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <dt className="text-muted-foreground">{step.label}</dt>
                        <dd className="font-bold tabular-nums">{step.value} %</dd>
                      </div>
                      <ProgressBar value={step.value} className="mt-1.5" />
                    </div>
                  ))}
                </dl>
              )}
            </div>
            {patch.downloadUrl ? (
              <Button asChild size="pill" className="w-full">
                <a href={patch.downloadUrl} target="_blank" rel="noopener noreferrer">
                  <Download /> Télécharger le patch
                </a>
              </Button>
            ) : (
              <Button size="pill" className="w-full" disabled>
                Bientôt disponible
              </Button>
            )}
            <p className="text-center text-xs text-muted-foreground">Le jeu original n’est pas inclus.</p>
            <Suspense fallback={null}>
              <EditLink id={patch.id} />
            </Suspense>
          </div>
        </aside>

        <div className="min-w-0 space-y-12">
          {patch.description && (
            <section>
              <h2 className="sr-only">Présentation</h2>
              <Markdown>{patch.description}</Markdown>
            </section>
          )}
          {patch.screenshots.length > 0 && (
            <section>
              <h2 className="mb-5 text-xl font-extrabold tracking-tight">Captures d’écran</h2>
              <Gallery
                images={patch.screenshots.map((image) => ({
                  src: imageUrl(image),
                  alt: image.alt,
                  width: image.width,
                  height: image.height,
                }))}
              />
            </section>
          )}
        </div>
      </div>
    </article>
  );
}

async function EditLink({ id }: { id: number }) {
  const viewer = await getViewer();
  if (!viewer?.isTeam) return null;
  return (
    <Button asChild variant="outline" size="pill" className="w-full">
      <Link href={`/gestion/patchs/${id}`}>
        <Pencil /> Modifier
      </Link>
    </Button>
  );
}
