import { ChevronRight, Newspaper, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TabsContent } from "@/components/lightswind/tabs";
import { CoverPlaceholder, ProgressBar, StatusBadge } from "@/components/content-meta";
import { TeamGate } from "@/components/team-gate";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/member-avatar";
import { listNews, newsDate } from "@/lib/news";
import { listNovels } from "@/lib/novels";
import { formatDate, imageUrl, listPatches } from "@/lib/patches";
import { listTeam } from "@/lib/team";
import { ActivityFeed, type FeedParams } from "./activity-feed";
import { GestionTabs } from "./gestion-tabs";

export const metadata: Metadata = { title: "Gestion" };

const TABS = ["activite", "actualites", "novels", "patchs", "jeux", "equipe"] as const;
type Tab = (typeof TABS)[number];
const isTab = (value: unknown): value is Tab => TABS.includes(value as Tab);

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default function ManagePage({ searchParams }: PageProps<"/gestion">) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <TeamGate>
        <p className="text-xs font-extrabold tracking-[0.14em] text-primary uppercase">Espace équipe</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Gestion du contenu</h1>
        <Dashboard searchParams={searchParams} />
      </TeamGate>
    </Suspense>
  );
}

// Tableau de bord en onglets : le feed d’activité, puis une liste par type de contenu.
// L’onglet ouvert vient de l’adresse (?onglet=…), le feed lit aussi ses filtres et sa page.
async function Dashboard({ searchParams }: { searchParams: PageProps<"/gestion">["searchParams"] }) {
  const query = await searchParams;
  const onglet = one(query.onglet);
  const feed: FeedParams = { membre: one(query.membre), type: one(query.type), page: one(query.page) };
  const [news, novels, allPatches, team] = await Promise.all([listNews({ publishedOnly: false }), listNovels({ drafts: true }), listPatches(undefined, { drafts: true }), listTeam()]);
  const patches = allPatches.filter((patch) => patch.kind === "vn");
  const games = allPatches.filter((patch) => patch.kind === "jeu");

  return (
    <GestionTabs
      initial={isTab(onglet) ? onglet : "activite"}
      tabs={[
        { value: "activite", label: "Activité" },
        { value: "actualites", label: "Actualités", count: news.length },
        { value: "novels", label: "Novels", count: novels.length },
        { value: "patchs", label: "Patchs", count: patches.length },
        { value: "jeux", label: "Jeux", count: games.length },
        { value: "equipe", label: "Équipe", count: team.length },
      ]}
    >
      <TabsContent value="activite">
        <ActivityFeed params={feed} />
      </TabsContent>
      <TabsContent value="actualites">
        <NewsList news={news} />
      </TabsContent>
      <TabsContent value="novels">
        <NovelList novels={novels} />
      </TabsContent>
      <TabsContent value="patchs">
        <PatchList patches={patches} kind="vn" />
      </TabsContent>
      <TabsContent value="jeux">
        <PatchList patches={games} kind="jeu" />
      </TabsContent>
      <TabsContent value="equipe">
        <TeamList team={team} />
      </TabsContent>
    </GestionTabs>
  );
}

function Section({ title, newHref, newLabel, children }: { title: string; newHref: string; newLabel: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
        <Button asChild size="pill">
          <Link href={newHref}>
            <Plus /> {newLabel}
          </Link>
        </Button>
      </div>
      {children}
    </section>
  );
}

function Row({ href, cover, title, meta, side }: { href: string; cover: string | null; title: string; meta: string; side: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-4 p-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
      >
        <div className="aspect-[3/4] w-12 shrink-0 overflow-hidden rounded-lg border border-border">
          {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <CoverPlaceholder title="" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold group-hover:text-primary">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{meta}</p>
        </div>
        <div className="hidden w-40 sm:block">{side}</div>
        <ChevronRight className="size-5 text-muted-foreground group-hover:text-primary" />
      </Link>
    </li>
  );
}

const listClass = "divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card";
const empty = (text: string) => (
  <p className="rounded-2xl border border-dashed border-border-strong p-8 text-center text-muted-foreground">{text}</p>
);

function NewsList({ news }: { news: Awaited<ReturnType<typeof listNews>> }) {
  return (
    <Section title="Actualités" newHref="/gestion/actualites/nouveau" newLabel="Nouvelle actualité">
      {news.length === 0 ? (
        empty("Aucune actualité pour l’instant.")
      ) : (
        <ul className={listClass}>
          {news.map((item) => (
            <li key={item.id}>
              <Link
                href={`/gestion/actualites/${item.id}`}
                className="group flex items-center gap-4 p-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-border bg-secondary text-muted-foreground">
                  <Newspaper className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold group-hover:text-primary">{item.title}</p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {formatDate(newsDate(item))}
                    {item.author && ` · ${item.author}`}
                  </p>
                </div>
                <StatusBadge status={item.published ? "Publiée" : "Brouillon"} className="hidden sm:inline-flex" />
                <ChevronRight className="size-5 text-muted-foreground group-hover:text-primary" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function NovelList({ novels }: { novels: Awaited<ReturnType<typeof listNovels>> }) {
  return (
    <Section title="Light novels" newHref="/gestion/novels/nouveau" newLabel="Nouveau novel">
      {novels.length === 0 ? (
        empty("Aucun light novel pour l’instant.")
      ) : (
        <ul className={listClass}>
          {novels.map((novel) => (
            <Row
              key={novel.id}
              href={`/gestion/novels/${novel.id}`}
              cover={novel.cover && imageUrl(novel.cover)}
              title={novel.title}
              meta={`${novel.publishedCount} publié(s) sur ${novel.chapterCount} chapitre(s) · mis à jour le ${formatDate(novel.updatedAt)}`}
              side={
                <span className="flex flex-wrap gap-1.5">
                  {novel.draft ? <StatusBadge status="Brouillon" /> : null}
                  <StatusBadge status={novel.status} />
                </span>
              }
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

const PATCH_SECTIONS = {
  vn: { title: "Patchs VN", newHref: "/gestion/patchs/nouveau", newLabel: "Nouveau patch", empty: "Aucun patch pour l’instant." },
  jeu: { title: "Jeux", newHref: "/gestion/patchs/nouveau?type=jeu", newLabel: "Nouveau jeu", empty: "Aucun jeu pour l’instant." },
} as const;

function PatchList({ patches, kind }: { patches: Awaited<ReturnType<typeof listPatches>>; kind: keyof typeof PATCH_SECTIONS }) {
  const section = PATCH_SECTIONS[kind];
  return (
    <Section title={section.title} newHref={section.newHref} newLabel={section.newLabel}>
      {patches.length === 0 ? (
        empty(section.empty)
      ) : (
        <ul className={listClass}>
          {patches.map((patch) => (
            <Row
              key={patch.id}
              href={`/gestion/patchs/${patch.id}`}
              cover={patch.cover && imageUrl(patch.cover)}
              title={patch.title}
              meta={`${patch.screenshots.length} capture(s) · mis à jour le ${formatDate(patch.updatedAt)}`}
              side={
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex flex-wrap gap-1.5">
                      {patch.draft ? <StatusBadge status="Brouillon" /> : null}
                      <StatusBadge status={patch.status} />
                    </span>
                    <span className="font-semibold text-muted-foreground tabular-nums">{patch.progress} %</span>
                  </div>
                  <ProgressBar value={patch.progress} className="mt-2" />
                </>
              }
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

function TeamList({ team }: { team: Awaited<ReturnType<typeof listTeam>> }) {
  return (
    <Section title="Équipe" newHref="/gestion/equipe/nouveau" newLabel="Nouveau membre">
      {team.length === 0 ? (
        empty("Aucun membre pour l’instant.")
      ) : (
        <ul className={listClass}>
          {team.map((member) => (
            <li key={member.id}>
              <Link
                href={`/gestion/equipe/${member.id}`}
                className="group flex items-center gap-4 p-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
              >
                <MemberAvatar member={member} className="size-12 text-lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold group-hover:text-primary">{member.name}</p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{member.title || "Sans titre"}</p>
                </div>
                <ChevronRight className="size-5 text-muted-foreground group-hover:text-primary" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
