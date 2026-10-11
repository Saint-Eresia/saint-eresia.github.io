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
import { getMember, listTeamPatchRoles, roleLabels } from "@/lib/team";
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
  const patches = (await listTeamPatchRoles()).get(member.id) ?? [];
  const created = (await searchParams).cree === "1";

  return (
    <>
      <ManageHeader
        back={{ href: "/gestion", label: "Gestion" }}
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
            <h2 className="text-sm font-semibold">Rôles par patch</h2>
            {patches.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Ce membre ne participe à aucun patch. Ajoutez-le dans la section « Équipe du patch » d’un patch.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
                {patches.map((patch) => (
                  <li key={patch.patchId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold">{patch.title}</p>
                      <p className="text-xs text-muted-foreground">{roleLabels(patch.roles).join(" · ") || "Aucun rôle coché"}</p>
                    </div>
                    <Link
                      href={`/gestion/patchs/${patch.patchId}#equipe-patch`}
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
