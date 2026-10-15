import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Dropzone } from "@/components/dropzone";
import { ManageHeader, panel } from "@/components/manage-header";
import { MemberAvatar } from "@/components/member-avatar";
import { TeamGate } from "@/components/team-gate";
import { Button } from "@/components/ui/button";
import { getMember, listTeamProjectRoles, roleLabels } from "@/lib/team";
import { DeleteMemberButton } from "../delete-member-button";
import { MemberForm } from "../member-form";

export const metadata: Metadata = { title: "Modifier un membre" };

type Props = PageProps<"/gestion/equipe/[id]">;

export default function EditMemberPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <TeamGate>
        <EditMember params={params} searchParams={searchParams} />
      </TeamGate>
    </Suspense>
  );
}

async function EditMember({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const member = await getMember(Number((await params).id));
  if (!member) notFound();
  const projects = (await listTeamProjectRoles({ drafts: true })).get(member.id) ?? [];
  const created = (await searchParams).cree === "1";

  return (
    <>
      <ManageHeader
        back={{ href: "/gestion?onglet=equipe", label: "Gestion" }}
        title={member.name}
        created={created && "Membre ajouté. Ajoutez maintenant son avatar."}
        actions={
          <Button asChild variant="outline" size="pill">
            <Link href="/equipe">
              Voir la page Équipe <ExternalLink />
            </Link>
          </Button>
        }
      />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className={panel} aria-label="Informations du membre">
          <MemberForm member={member} />
          <div className="mt-8 border-t border-border pt-6">
            <h2 className="text-sm font-semibold">Rôles par projet</h2>
            {projects.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Ce membre ne participe à aucun projet. Ajoutez-le dans la section « Équipe » d’un patch ou d’un novel.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
                {projects.map((project) => (
                  <li key={project.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {project.title}
                        {project.draft && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(brouillon)</span>}
                      </p>
                      <p className="text-xs text-muted-foreground">{roleLabels(project.roles).join(" · ") || "Aucun rôle coché"}</p>
                    </div>
                    <Link
                      href={project.editHref}
                      className="text-sm font-semibold text-primary hover:underline"
                    >
                      Modifier
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section className={`${panel} space-y-4 self-start`}>
          <h2 className="text-lg font-extrabold">Avatar</h2>
          <MemberAvatar member={member} className="size-28 text-3xl" />
          <Dropzone
            endpoint={`/api/team/${member.id}/avatar`}
            kind="avatar"
            label={member.avatarFile ? "Remplacer l’avatar" : "Ajouter un avatar"}
          />
          <p className="text-xs text-muted-foreground">L’image est recadrée en carré.</p>
        </section>
      </div>
      <section className="mt-10 rounded-2xl border border-destructive/30 p-6">
        <h2 className="text-lg font-extrabold text-destructive">Zone de danger</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">Le membre disparaîtra de la page Équipe.</p>
        <DeleteMemberButton memberId={member.id} name={member.name} />
      </section>
    </>
  );
}
