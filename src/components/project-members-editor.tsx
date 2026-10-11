import { MemberPicker } from "@/components/member-picker";
import { listNovelMemberIds, listTeam } from "@/lib/team";

// Section de gestion d’un novel : membres de l’équipe affichés sur sa fiche publique (sans rôle par projet ;
// les rôles détaillés existent pour les patchs).
export async function ProjectMembersEditor({
  id,
  save,
}: {
  id: number;
  save: (memberIds: number[]) => Promise<{ error?: string }>;
}) {
  const [team, selected] = await Promise.all([listTeam(), listNovelMemberIds(id)]);
  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-6 sm:p-8" aria-labelledby="equipe-projet">
      <h2 id="equipe-projet" className="text-lg font-extrabold">
        Équipe du projet
      </h2>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        Les membres cochés apparaissent sur la fiche publique, avec leur titre.
      </p>
      <MemberPicker
        members={team.map((member) => ({
          id: member.id,
          name: member.name,
          avatarFile: member.avatarFile,
          role: member.title,
        }))}
        selected={selected}
        save={save}
      />
    </section>
  );
}
