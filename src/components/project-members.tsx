import Link from "next/link";
import { MemberAvatar } from "@/components/member-avatar";
import { ROLE_LABELS, type RoleKey } from "@/lib/roles";
import { cn } from "@/lib/utils";

type Member = { id: number; slug: string; name: string; avatarFile: string; title: string; roles: RoleKey[] };

// Carte « Équipe » d’une fiche : les membres qui ont participé au patch ou au novel.
// Sous le nom : ses rôles sur ce projet, sinon son titre. Chaque membre renvoie vers sa présentation (/equipe#slug).
export function ProjectMembers({ members, className }: { members: Member[]; className?: string }) {
  if (members.length === 0) return null;
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-6", className)} aria-labelledby="participants">
      <h2 id="participants" className="text-sm font-semibold text-muted-foreground">
        Équipe
      </h2>
      <ul className="mt-4 space-y-1">
        {members.map((member) => {
          const detail = member.roles.length ? member.roles.map((role) => ROLE_LABELS[role]).join(" · ") : member.title;
          return (
            <li key={member.id}>
              <Link
                href={`/equipe#${member.slug || `membre-${member.id}`}`}
                className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted"
              >
                <MemberAvatar member={member} className="size-10 shrink-0 text-base" />
                <span className="min-w-0">
                  <span className="block truncate font-bold">{member.name}</span>
                  {detail && <span className="block text-xs text-muted-foreground">{detail}</span>}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
