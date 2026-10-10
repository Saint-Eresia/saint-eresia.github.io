import { ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CoverPlaceholder, ProgressBar, StatusBadge } from "@/components/content-meta";
import { TeamGate } from "@/components/team-gate";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/member-avatar";
import { listNovels } from "@/lib/novels";
import { formatDate, imageUrl, listPatches } from "@/lib/patches";
import { listTeam } from "@/lib/team";

export const metadata: Metadata = { title: "Gestion" };

export default function ManagePage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <TeamGate>
        <p className="text-xs font-extrabold tracking-[0.14em] text-primary uppercase">Espace équipe</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Gestion du contenu</h1>
        <NovelList />
        <PatchList />
        <TeamList />
      </TeamGate>
    </Suspense>
  );
}

function Section({ title, newHref, newLabel, children }: { title: string; newHref: string; newLabel: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
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

async function NovelList() {
  const novels = await listNovels();
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
              side={<StatusBadge status={novel.status} />}
            />
          ))}
        </ul>
      )}
    </Section>
  );
}

async function PatchList() {
  const patches = await listPatches();
  return (
    <Section title="Patchs VN" newHref="/gestion/patchs/nouveau" newLabel="Nouveau patch">
      {patches.length === 0 ? (
        empty("Aucun patch pour l’instant.")
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
                    <StatusBadge status={patch.status} />
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

async function TeamList() {
  const team = await listTeam();
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
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{member.roles.join(" · ") || "Aucun rôle"}</p>
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
