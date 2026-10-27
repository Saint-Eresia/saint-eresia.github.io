import { ArrowLeft, ChevronRight, Download, Images, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CoverPlaceholder, NOVEL_COVER, StatusBadge } from "@/components/content-meta";
import { Markdown } from "@/components/markdown";
import { projectLayout } from "@/components/project-layout";
import { ProjectMembers } from "@/components/project-members";
import { ReeditBadge } from "@/components/reedit-badge";
import { Button } from "@/components/ui/button";
import { canSeeNovel, chapterHeading, getNovelBySlug, isPublicNovel, volumeHeading, type ChapterSummary, type VolumeWithChapters } from "@/lib/novels";
import { fileUrl } from "@/lib/file-url";
import { excerpt } from "@/lib/news";
import { formatDate, imageUrl } from "@/lib/patches";
import { socialMetadata } from "@/lib/site-url";
import { listNovelTeam } from "@/lib/team";
import { getViewer } from "@/lib/viewer";
import { ResumeButton } from "./resume-button";

export async function generateMetadata({ params }: PageProps<"/novels/[slug]">): Promise<Metadata> {
  const novel = await getNovelBySlug((await params).slug);
  if (!novel || !(await canSeeNovel(novel))) return { title: "Light novel introuvable" };
  if (!isPublicNovel(novel)) return { title: `${novel.title} (brouillon)`, robots: { index: false } };
  // Aperçu de partage : citation (ou début de la présentation), arrière-plan en grand, sinon couverture.
  const image = novel.background ?? novel.cover;
  return {
    title: novel.title,
    ...socialMetadata({
      title: novel.title,
      description: novel.quote || excerpt(novel.synopsis, 200),
      image: image && imageUrl(image),
      large: !!novel.background,
      type: "book",
    }),
  };
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
      {/* En-tête : bandeau (arrière-plan net, sinon couverture floutée), couverture à cheval sur son bord bas,
          statut et format à côté d’elle dans le bandeau, titre en dessous, citation en haut à droite. */}
      <header className="border-b border-border pb-8">
        <div className="relative isolate h-44 overflow-hidden sm:h-64 lg:h-80">
          {novel.background ? (
            <img src={imageUrl(novel.background)} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-center" />
          ) : (
            <>
              {novel.cover && (
                <img
                  src={imageUrl(novel.cover)}
                  alt=""
                  className="absolute inset-0 -z-20 h-full w-full scale-110 object-cover opacity-40 blur-3xl saturate-150"
                />
              )}
              <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-background/30 to-background/70" />
            </>
          )}
          <div className={`relative h-full ${layout.container}`}>
            <Link
              href="/novels"
              className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-background/75 px-3 py-1.5 text-sm font-semibold text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground sm:left-6"
            >
              <ArrowLeft className="size-4" /> Novels
            </Link>
          </div>
        </div>

        <div className={layout.container}>
          <div className="flex gap-4 sm:gap-8">
            {/* Largeur fixe, hauteur selon les proportions de la couverture (sans recadrage). */}
            <div className="relative z-10 -mt-24 w-28 shrink-0 self-start overflow-hidden rounded-lg bg-card shadow-[0_24px_60px_var(--shadow)] sm:-mt-40 sm:w-44 lg:-mt-48 lg:w-52">
              {novel.cover ? (
                <img
                  src={imageUrl(novel.cover)}
                  alt={novel.cover.alt}
                  width={novel.cover.width}
                  height={novel.cover.height}
                  className="block h-auto w-full"
                />
              ) : (
                <div className={NOVEL_COVER}>
                  <CoverPlaceholder title={novel.title} />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              {/* Remontés dans le bandeau ; la période de sortie chevauche son bord, à droite. */}
              <div className="-mt-16 flex h-16 items-end justify-between gap-4 pb-2">
                <div className="flex flex-col items-start gap-1.5">
                  <span className="inline-flex rounded-full bg-background/90 backdrop-blur-sm">
                    <StatusBadge status={novel.status} />
                  </span>
                  {novel.format && (
                    <span className="rounded-md border border-foreground/50 bg-background/85 px-3 py-0.5 text-sm font-bold tracking-wide backdrop-blur-sm">
                      {novel.format}
                    </span>
                  )}
                </div>
                {novel.released && (
                  <p className="hidden translate-y-[calc(50%+0.5rem)] items-center divide-x divide-border rounded-xl border border-border bg-card text-sm shadow-[0_12px_40px_var(--shadow)] sm:flex">
                    <span className="px-4 py-2 font-semibold text-muted-foreground">Sorti</span>
                    <span className="px-4 py-2 font-bold">{novel.released}</span>
                  </p>
                )}
              </div>
              <h1 className="mt-4 text-2xl leading-tight font-extrabold tracking-tight text-balance sm:text-3xl lg:text-4xl">
                {novel.title}
              </h1>
              {novel.author && <p className="mt-2 text-muted-foreground">par {novel.author}</p>}
              {novel.released && <p className="mt-1 text-sm text-muted-foreground sm:hidden">Sorti : {novel.released}</p>}
              {novel.quote && <HeroQuote quote={novel.quote} note={novel.quoteNote} />}
              {!isPublicNovel(novel) && (
                <p role="status" className="mt-4 w-fit rounded-xl border border-warning/40 bg-warning/10 px-4 py-2 text-sm font-semibold text-warning">
                  Brouillon : ce novel n’est visible que par l’équipe.
                </p>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className={layout.body}>
        <aside className={layout.aside}>
          <div className={`space-y-5 rounded-2xl border border-border bg-card p-6 ${layout.sticky}`}>
            {first ? (
              <ResumeButton
                novelSlug={novel.slug}
                firstSlug={first.slug}
                chapters={novel.volumes.flatMap((volume) => volume.chapters.map((chapter) => chapter.slug))}
              />
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
                    {group.heading && (
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border bg-secondary px-5 py-3">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h3 className="font-bold">{group.heading}</h3>
                          {group.reedit && <ReeditBadge />}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          {group.translators && <p className="text-xs text-muted-foreground">Traduction : {group.translators}</p>}
                          {group.volumeNumber !== undefined && group.illustrationCount > 0 && (
                            <Link
                              href={`/novels/${novel.slug}/illustrations/${group.volumeNumber}`}
                              title={`Voir les ${group.illustrationCount} illustrations de ${group.heading}`}
                              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold transition-colors hover:border-primary hover:text-primary"
                            >
                              <Images className="size-3.5" /> Illustrations
                            </Link>
                          )}
                          {group.volumeNumber !== undefined && (
                            // Lien simple (pas de préchargement) : l’EPUB est généré à la première demande.
                            <a
                              href={`/novels/${novel.slug}/epub/${group.volumeNumber}`}
                              title={`Télécharger ${group.heading} en EPUB, pour liseuse`}
                              className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold transition-colors hover:border-primary hover:text-primary"
                            >
                              <Download className="size-3.5" /> EPUB
                            </a>
                          )}
                        </div>
                      </div>
                    )}
                    {group.image && (
                      <figure className="border-b border-border bg-muted/40">
                        {/* Bannière ou couverture : affichée entière, centrée, quelle que soit sa proportion. */}
                        <img src={group.image} alt={`Illustration de ${group.heading}`} className="mx-auto block max-h-[30rem] w-auto max-w-full" />
                        {group.imageCredit && (
                          <figcaption className="px-5 py-2 text-xs text-muted-foreground">
                            <Markdown>{group.imageCredit}</Markdown>
                          </figcaption>
                        )}
                      </figure>
                    )}
                    {group.note && (
                      <div className="border-b border-border bg-secondary/50 px-5 py-3 text-sm">
                        <Markdown>{group.note}</Markdown>
                      </div>
                    )}
                    {group.sections.map((section, index) => (
                      <section key={index} className={index > 0 ? "border-t border-border" : undefined}>
                        {section.phase && (
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-4 pb-1">
                            <h4 className="text-sm font-bold tracking-wide text-primary uppercase">{section.phase}</h4>
                            {section.credit && (
                              <p className="text-xs text-muted-foreground">
                                Traduction :{" "}
                                {section.credit.href ? (
                                  <a href={section.credit.href} className="underline underline-offset-2 hover:text-primary">
                                    {section.credit.name}
                                  </a>
                                ) : (
                                  section.credit.name
                                )}
                              </p>
                            )}
                          </div>
                        )}
                        <ol className="divide-y divide-border">
                          {section.rows.map(({ chapter, heading }) => (
                            <li key={chapter.id}>
                              <Link
                                href={`/novels/${novel.slug}/${chapter.slug}`}
                                className="group flex items-center gap-4 px-5 py-3 transition-colors hover:bg-muted/50"
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block font-semibold group-hover:text-primary">
                                    <span aria-hidden className="mr-1.5 text-primary">•</span>
                                    {heading}
                                    {isNew(chapter) && (
                                      <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 align-middle text-[0.7rem] font-bold text-primary">
                                        Nouveau
                                      </span>
                                    )}
                                  </span>
                                  {chapter.translators && !group.translators && !section.credit && (
                                    <span className="block text-xs text-muted-foreground">Traduction : {chapter.translators}</span>
                                  )}
                                </span>
                                <span className="hidden text-xs text-muted-foreground sm:block">{formatDate(releaseOf(chapter))}</span>
                                <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary" />
                              </Link>
                            </li>
                          ))}
                        </ol>
                      </section>
                    ))}
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

// Citation (ex. accroche de la couverture du light novel original) sous le titre, comme un sous-titre,
// en serif italique comme sur le livre : elle ne masque rien de l’arrière-plan.
// Son commentaire éventuel (ex. sa provenance) s’affiche dans une bulle au survol ou au focus.
function HeroQuote({ quote, note }: { quote: string; note: string }) {
  return (
    <figure
      tabIndex={note ? 0 : undefined}
      aria-describedby={note ? "citation-commentaire" : undefined}
      className={`group relative mt-4 w-fit max-w-2xl outline-none ${note ? "cursor-help" : ""}`}
    >
      <blockquote className="font-[Georgia,'Times_New_Roman',serif] text-base leading-snug text-pretty text-foreground/80 italic sm:text-lg">
        « {quote} »
      </blockquote>
      {note && (
        <figcaption
          id="citation-commentaire"
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-0 z-10 mb-3 w-max max-w-72 translate-y-1 rounded-lg border border-border bg-popover px-3 py-2 text-sm text-popover-foreground opacity-0 shadow-[0_12px_40px_var(--shadow)] transition group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
        >
          {note}
        </figcaption>
      )}
    </figure>
  );
}

// Traducteurs communs à tous les chapitres d’un tome (au moins deux), pour ne pas les répéter à chaque ligne.
function sharedTranslators(chapters: ChapterSummary[]) {
  const [first] = chapters;
  return chapters.length > 1 && first.translators && chapters.every((c) => c.translators === first.translators) ? first.translators : undefined;
}

// Date de sortie d’un chapitre (celle choisie, sinon sa création), au format de la base.
const releaseOf = (chapter: ChapterSummary) => chapter.publishedAt ?? chapter.createdAt;
const NEW_FOR_MS = 7 * 24 * 60 * 60 * 1000;
// « Nouveau » : sorti il y a moins de 7 jours (et pas dans le futur).
function isNew(chapter: ChapterSummary) {
  const age = Date.now() - new Date(releaseOf(chapter).replace(" ", "T") + "Z").getTime();
  return age >= 0 && age < NEW_FOR_MS;
}

// Équipe créditée pour toute une phase : traducteurs communs, ou équipe extérieure dont le lien
// figure dans les crédits détaillés de chaque chapitre (« — [Équipe](https://…) »), renvoyée vers son site.
function phaseCredit(chapters: ChapterSummary[]): { name: string; href?: string } | undefined {
  const shared = sharedTranslators(chapters);
  if (shared) return { name: shared };
  const teams = chapters.map((chapter) => /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/.exec(chapter.credits));
  const [first] = teams;
  if (chapters.length < 2 || !first || teams.some((team) => team?.[1] !== first[1])) return undefined;
  return { name: first[1], href: new URL(first[2]).origin };
}

type Row = { chapter: ChapterSummary; heading: string };
type Section = { phase: string; credit?: { name: string; href?: string }; rows: Row[] };

// Chapitres consécutifs d’une même phase regroupés sous un sous-titre ; sans phase, une seule section.
function sectionsOf(chapters: ChapterSummary[]): Section[] {
  const sections: (Section & { chapters: ChapterSummary[] })[] = [];
  for (const chapter of chapters) {
    const last = sections.at(-1);
    const row = { chapter, heading: chapterHeading(chapter) };
    if (last && last.phase === chapter.phase) {
      last.rows.push(row);
      last.chapters.push(chapter);
    } else sections.push({ phase: chapter.phase, rows: [row], chapters: [chapter] });
  }
  return sections.map(({ chapters, ...section }) => ({ ...section, credit: section.phase ? phaseCredit(chapters) : undefined }));
}

// Un tome lu d’un bloc (un seul chapitre « Tome N ») n’a pas besoin d’en-tête :
// ces tomes consécutifs sont regroupés dans une même liste.
function tableOfContents(volumes: VolumeWithChapters[]) {
  const groups: {
    key: string;
    heading: string | null;
    note?: string;
    image?: string; // image en tête du tome
    imageCredit?: string;
    reedit?: boolean; // traduction d’une autre équipe, ré-éditée : mention « Re:edit »
    translators?: string; // commun à tous les chapitres du tome : affiché une fois dans l’en-tête
    volumeNumber?: number; // tome téléchargeable en EPUB
    illustrationCount: number; // lien vers la page des illustrations du tome
    sections: Section[];
  }[] = [];
  for (const volume of volumes) {
    const [only] = volume.chapters;
    const whole = volume.chapters.length === 1 && only.label === `Tome ${volume.number}`;
    if (!whole) {
      groups.push({
        key: `v${volume.id}`,
        heading: volumeHeading(volume),
        note: volume.note,
        image: volume.image && fileUrl(volume.image),
        imageCredit: volume.imageCredit,
        reedit: Number(volume.reedit) === 1,
        translators: sharedTranslators(volume.chapters),
        volumeNumber: volume.number,
        illustrationCount: volume.illustrationCount,
        sections: sectionsOf(volume.chapters),
      });
      continue;
    }
    const row = { chapter: only, heading: only.title ? `${volumeHeading(volume)} — ${only.title}` : volumeHeading(volume) };
    const last = groups.at(-1);
    if (last && last.heading === null) last.sections[0].rows.push(row);
    else groups.push({ key: `t${volume.id}`, heading: null, illustrationCount: 0, sections: [{ phase: "", rows: [row] }] });
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
