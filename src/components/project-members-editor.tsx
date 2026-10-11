import { MemberPicker } from "@/components/member-picker";
import { listProjectLinks, listTeam, type ProjectType } from "@/lib/team";

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
  const [team, links] = await Promise.all([listTeam(), listProjectLinks(type, id)]);
  const projectRoles = new Map(links.map((link) => [link.memberId, link.role]));
  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8" aria-labelledby="equipe-projet">
      <h2 id="equipe-projet" className="text-lg font-extrabold">
        Équipe du projet
      </h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        {type === "patch"
          ? "Les membres cochés apparaissent sur la fiche publique, avec leur rôle sur ce VN (section « Rôles par VN » de leur fiche membre) ou, à défaut, leur premier rôle."
          : "Les membres cochés apparaissent sur la fiche publique, avec leur premier rôle."}
      </p>
      <MemberPicker
        members={team.map((member) => ({
          id: member.id,
          name: member.name,
          avatarFile: member.avatarFile,
          role: projectRoles.get(member.id) || member.roles[0] || "",
        }))}
        selected={links.map((link) => link.memberId)}
        save={save}
      />
    </section>
  );
}
