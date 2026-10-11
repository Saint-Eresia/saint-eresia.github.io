import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageIntro } from "@/components/page-intro";
import { listNovels } from "@/lib/novels";
import { PATCH_KINDS, patchHref } from "@/lib/patch-kinds";
import { listPatches } from "@/lib/patches";
import { listTeam, memberAnchor } from "@/lib/team";

export const metadata: Metadata = {
  title: "À propos",
  description: "L’histoire de Saint Eresia et nos conventions de traduction.",
};

// Conventions de traduction de l’équipe. Pour en ajouter une, compléter cette liste.
const CONVENTIONS = [
  {
    title: "Noms japonais : NOM Prénom",
    body: (
      <>
        Les personnages japonais gardent l’ordre japonais, le nom de famille d’abord : <em>Miyashiro Takuru</em>, et non{" "}
        <em>Takuru Miyashiro</em>.
      </>
    ),
  },
  {
    title: "Termes en katakana",
    body: (
      <>
        Les termes écrits en katakana, souvent des emprunts à l’anglais, sont gardés tels quels, sauf exception.
      </>
    ),
  },
  {
    title: "Une localisation qui n’enlève rien",
    body: (
      <>
        Nous adaptons pour le lecteur français sans retirer ce qui fait l’œuvre. Dans CHAOS;HEAD, les références aux réseaux
        reprennent des équivalents connus en France, comme Twitter, mais les blagues propres au cadre japonais restent : une
        adaptation propre, et une localisation sans coupe.
      </>
    ),
  },
];

export default function AboutPage() {
  return (
    <>
      <PageIntro eyebrow="À propos" title="Saint Eresia">
        Une équipe de traduction amateur qui adapte en français des visual novels, des jeux vidéo et des light novels.
      </PageIntro>

      <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-12">
          <section aria-labelledby="histoire">
            <h2 id="histoire" className="text-2xl font-extrabold tracking-tight">
              Notre histoire
            </h2>
            <Suspense fallback={<div className="mt-4 h-32 animate-pulse rounded-2xl bg-muted" />}>
              <History />
            </Suspense>
          </section>

          <section aria-labelledby="conventions">
            <h2 id="conventions" className="text-2xl font-extrabold tracking-tight">
              Nos conventions de traduction
            </h2>
            <p className="mt-3 text-muted-foreground">
              Les mêmes règles pour tous les projets, pour que chaque traduction se lise de la même façon.
            </p>
            <ol className="mt-6 space-y-4">
              {CONVENTIONS.map((convention, index) => (
                <li key={convention.title} className="flex gap-4 rounded-2xl border border-border bg-card p-5">
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-extrabold text-accent-foreground"
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="font-bold">{convention.title}</h3>
                    <p className="mt-1.5 leading-relaxed text-muted-foreground">{convention.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-4 lg:pt-1">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
            <Projects />
          </Suspense>
        </aside>
      </div>
    </>
  );
}

// L’histoire s’appuie sur la base : fondateurs (titre « Fondateur ») et nombre de membres et de projets.
async function History() {
  const [team, patches, novels] = await Promise.all([listTeam(), listPatches(), listNovels()]);
  const founders = team.filter((member) => member.title.toLowerCase().startsWith("fondat"));
  const vn = patches.filter((patch) => patch.kind === "vn").length;
  const games = patches.length - vn;

  return (
    <div className="mt-4 space-y-4 leading-relaxed">
      <p>
        Saint Eresia est née de l’envie de faire découvrir en français des œuvres japonaises peu ou pas traduites dans notre
        langue.
        {founders.length > 0 && (
          <>
            {" "}
            L’équipe a été fondée par{" "}
            {founders.map((member, index) => (
              <span key={member.id}>
                {index > 0 && (index === founders.length - 1 ? " et " : ", ")}
                <Link href={`/equipe#${memberAnchor(member)}`} className="font-semibold text-primary hover:underline">
                  {member.name}
                </Link>
              </span>
            ))}
            .
          </>
        )}
      </p>
      <p>
        Elle compte aujourd’hui {team.length} membre{team.length > 1 ? "s" : ""} : traducteurs, correcteurs, graphistes,
        développeurs et testeurs. Ensemble, ils travaillent sur {vn} patch{vn > 1 ? "s" : ""} de visual novel
        {games > 0 && `, ${games} jeu${games > 1 ? "x" : ""} vidéo`} et {novels.length} light novel{novels.length > 1 ? "s" : ""}.
      </p>
      <p>
        Nos patchs ne contiennent que la traduction : le jeu original n’est jamais fourni, et nous encourageons à l’acheter.
      </p>
      <p>
        <Link href="/equipe" className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline">
          Découvrir l’équipe <ArrowRight className="size-4" aria-hidden />
        </Link>
      </p>
    </div>
  );
}

async function Projects() {
  const [patches, novels] = await Promise.all([listPatches(), listNovels()]);
  const groups = [
    { title: PATCH_KINDS.vn.plural, items: patches.filter((p) => p.kind === "vn").map((p) => ({ key: p.id, href: patchHref(p), title: p.title })) },
    { title: PATCH_KINDS.jeu.plural, items: patches.filter((p) => p.kind === "jeu").map((p) => ({ key: p.id, href: patchHref(p), title: p.title })) },
    { title: "Light novels", items: novels.map((n) => ({ key: n.id, href: `/novels/${n.slug}`, title: n.title })) },
  ].filter((group) => group.items.length > 0);

  return (
    <section aria-labelledby="projets" className="rounded-2xl border border-border bg-card p-6">
      <h2 id="projets" className="text-sm font-semibold text-muted-foreground">
        Nos projets
      </h2>
      {groups.map((group) => (
        <div key={group.title} className="mt-4">
          <h3 className="text-xs font-extrabold tracking-[0.12em] text-primary uppercase">{group.title}</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {group.items.map((item) => (
              <li key={item.key}>
                <Link href={item.href} className="font-semibold hover:text-primary hover:underline">
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
