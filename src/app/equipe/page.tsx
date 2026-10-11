import { Globe } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MemberAvatar } from "@/components/member-avatar";
import { EmptyState, PageIntro } from "@/components/page-intro";
import { LINK_KINDS, LINK_LABELS, listTeam, listTeamPatchRoles, memberAnchor, roleLabels, type LinkKind } from "@/lib/team";

export const metadata: Metadata = { title: "Équipe" };

// Icônes monochromes des liens (SVG affichés en masque CSS, ou composant).
const ICON_FILES: Partial<Record<LinkKind, string>> = {
  gamebanana: "/equipe/gamebanana.svg",
  youtube: "/equipe/youtube.svg",
  linktree: "/equipe/linktree.svg",
};

export default function TeamPage() {
  return (
    <>
      <PageIntro eyebrow="Équipe" title="Les membres de Saint Eresia">
        Traducteurs, développeurs et testeurs : les personnes derrière les novels et les patchs.
      </PageIntro>
      <section className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
          <Members />
        </Suspense>
      </section>
    </>
  );
}

async function Members() {
  const [team, patchRoles] = await Promise.all([listTeam(), listTeamPatchRoles()]);
  if (team.length === 0) return <EmptyState>L’équipe n’a pas encore été présentée.</EmptyState>;
  // Anciennes ancres (#membre-3) → nouvelles (#mekki), pour les liens déjà partagés.
  const legacy = Object.fromEntries(team.map((member) => [`membre-${member.id}`, memberAnchor(member)]));
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){var m=${JSON.stringify(legacy).replace(/</g, "\\u003c")};var h=location.hash.slice(1);if(m[h]){history.replaceState(null,"","#"+m[h]);var e=document.getElementById(m[h]);if(e)e.scrollIntoView();}})();`,
        }}
      />
      {team.map((member) => (
        <article key={member.id} id={memberAnchor(member)} className="scroll-mt-24 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-center gap-4">
            <MemberAvatar member={member} className="size-16 text-2xl" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-extrabold tracking-tight">{member.name}</h2>
              {member.title && <p className="text-sm text-primary">{member.title}</p>}
            </div>
            <div className="flex flex-wrap justify-end gap-1">
              {LINK_KINDS.filter((kind) => member.links[kind]).map((kind) => (
                <a
                  key={kind}
                  href={member.links[kind]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${LINK_LABELS[kind]} de ${member.name}`}
                  title={LINK_LABELS[kind]}
                  className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <LinkIcon kind={kind} />
                </a>
              ))}
            </div>
          </div>
          {(patchRoles.get(member.id) ?? []).length > 0 && (
            <dl className="mt-5 space-y-3 text-sm">
              {(patchRoles.get(member.id) ?? []).map((patch) => (
                <div key={patch.slug}>
                  <dt>
                    <Link href={`/patchs/${patch.slug}`} className="font-semibold text-muted-foreground hover:text-primary hover:underline">
                      {patch.title}
                    </Link>
                  </dt>
                  <dd className="mt-1.5 flex flex-wrap gap-1.5">
                    {patch.roles.length === 0 ? (
                      <span className="text-xs text-muted-foreground">Participation</span>
                    ) : (
                      roleLabels(patch.roles).map((role) => (
                        <span key={role} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">
                          {role}
                        </span>
                      ))
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </article>
      ))}
    </div>
  );
}

function LinkIcon({ kind }: { kind: LinkKind }) {
  if (kind === "github") return <GitHubIcon />;
  if (kind === "site") return <Globe className="size-4" aria-hidden />;
  return <span aria-hidden className="size-4 bg-current" style={{ mask: `url(${ICON_FILES[kind]}) center / contain no-repeat` }} />;
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
      <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.84.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.03a9.5 9.5 0 0 1 5 0c1.91-1.3 2.75-1.03 2.75-1.03.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .26.18.58.69.48A10 10 0 0 0 12 2Z" />
    </svg>
  );
}
