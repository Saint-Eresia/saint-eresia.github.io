import { fileUrl } from "@/lib/file-url";
import { listTeam, listTeamProjectRoles } from "@/lib/team";
import { ROLE_LABELS } from "@/lib/roles";

// Membres de l’équipe pour la fenêtre « À propos » d’EresiaLauncher (voir EresiaLauncher/src/catalogue.rs) :
// nom, titre, rôles (tous projets publics confondus) et avatar en adresse absolue.
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const [team, projects] = await Promise.all([listTeam(), listTeamProjectRoles()]);
  const body = team.map((member) => {
    const roles = [...new Set((projects.get(member.id) ?? []).flatMap((project) => project.roles))].map((role) => ROLE_LABELS[role]);
    const avatar = member.avatarFile ? fileUrl(member.avatarFile) : "";
    return { name: member.name, title: member.title, roles, avatar: avatar.startsWith("/") ? `${origin}${avatar}` : avatar };
  });
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=300" } });
}
