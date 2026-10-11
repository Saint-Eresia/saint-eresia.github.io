import { MemberPicker } from "@/components/member-picker";
import { listProjectMemberIds, listTeam, type ProjectType } from "@/lib/team";

// Section de gestion : membres de l’équipe affichés sur la fiche publique du patch ou du novel.
export async function ProjectMembersEditor({
  type,
  id,
  save,
}: {
  type: ProjectType;
  id: number;
  save: (memberIds: number[]) => Promise<{ error?: string }>;
}) {
  const [team, selected] = await Promise.all([listTeam(), listProjectMemberIds(type, id)]);
  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8" aria-labelledby="equipe-projet">
      <h2 id="equipe-projet" className="text-lg font-extrabold">
        Équipe du projet
      </h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        Les membres cochés apparaissent sur la fiche publique, avec leur premier rôle.
      </p>
      <MemberPicker
        members={team.map((member) => ({
          id: member.id,
          name: member.name,
          avatarFile: member.avatarFile,
          role: member.roles[0] ?? "",
        }))}
        selected={selected}
        save={save}
      />
    </section>
  );
}
