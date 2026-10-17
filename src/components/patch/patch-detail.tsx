import { ArrowLeft, Download, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { Gallery } from "@/components/patch/gallery";
import { Markdown } from "@/components/markdown";
import { CountUp } from "@/components/lightswind/count-up";
import { CoverPlaceholder, ProgressBar, StatusBadge } from "@/components/content-meta";
import { HeroBackdrop } from "@/components/hero-backdrop";
import { projectLayout } from "@/components/project-layout";
import { ProjectMembers } from "@/components/project-members";
import { Button } from "@/components/ui/button";
import { excerpt } from "@/lib/news";
import { PATCH_KINDS, patchHref, type PatchKind } from "@/lib/patch-kinds";
import { canSeePatch, formatDate, getPatchBySlug, imageUrl, isPublicPatch } from "@/lib/patches";
import { socialMetadata } from "@/lib/site-url";
import { listPatchTeam } from "@/lib/team";
import { getViewer } from "@/lib/viewer";

// Fiche publique d’un patch, partagée par /patchs/[slug] (visual novels) et /jeux/[slug] (autres jeux).
// Un patch ouvert depuis la mauvaise rubrique redirige vers la bonne adresse.
export async function patchMetadata(params: Promise<{ slug: string }>): Promise<Metadata> {
  const patch = await getPatchBySlug((await params).slug);
  if (!patch || !(await canSeePatch(patch))) return { title: "Patch introuvable" };
  if (!isPublicPatch(patch)) return { title: `${patch.title} (brouillon)`, robots: { index: false } };
  const image = patch.background ?? patch.cover;
  return {
    title: patch.title,
    ...socialMetadata({
      title: patch.title,
      description: patch.quote || excerpt(patch.description, 200),
      image: image && imageUrl(image),
      large: !!patch.background,
    }),
  };
}

export function PatchDetailPage({ params, kind }: { params: Promise<{ slug: string }>; kind: PatchKind }) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-6xl animate-pulse" />}>
      <PatchDetail params={params} kind={kind} />
    </Suspense>
  );
}

async function PatchDetail({ params, kind }: { params: Promise<{ slug: string }>; kind: PatchKind }) {
  const patch = await getPatchBySlug((await params).slug);
  // Patch en brouillon : réservé à l’équipe.
  if (!patch || !(await canSeePatch(patch))) notFound();
  if (patch.kind !== kind) permanentRedirect(patchHref(patch));
  const section = PATCH_KINDS[kind];
  const members = await listPatchTeam(patch.id);
  const layout = projectLayout(members.length > 0);

  return (
    <article>
      <header className="relative isolate overflow-hidden border-b border-border">
        <HeroBackdrop
          background={patch.background && imageUrl(patch.background)}
          cover={patch.cover && imageUrl(patch.cover)}
        />
        <div className={layout.hero}>
          <Link
            href={section.path}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> {section.plural}
          </Link>
          {!isPublicPatch(patch) && (
            <p role="status" className="mt-4 w-fit rounded-xl border border-warning/40 bg-warning/10 px-4 py-2 text-sm font-semibold text-warning">
              Brouillon : ce patch n’est visible que par l’équipe.
            </p>
          )}
          <div className="mt-8 grid gap-8 sm:grid-cols-[13rem_1fr] sm:items-end md:grid-cols-[15rem_1fr]">
            <div className="aspect-[3/4] w-40 overflow-hidden rounded-2xl border border-border shadow-[0_24px_60px_var(--shadow)] sm:w-full">
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

      <div className={layout.body}>
        <aside className={layout.aside}>
          <div className={`space-y-5 rounded-2xl border border-border bg-card p-6 ${layout.sticky}`}>
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-muted-foreground">Avancement</span>
                <CountUp value={patch.progress} suffix=" %" duration={1.2} className="text-2xl font-extrabold tabular-nums" />
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

        {members.length > 0 && (
          <aside className={layout.members}>
            <ProjectMembers members={members} className="2xl:sticky 2xl:top-24" />
          </aside>
        )}

        <div className={`space-y-12 ${layout.content}`}>
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
