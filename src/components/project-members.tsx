import Link from "next/link";
import { Badge } from "@/components/lightswind/badge";
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
          return (
            <li key={member.id}>
              <Link
                href={`/equipe#${member.slug || `membre-${member.id}`}`}
                className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted"
              >
                <MemberAvatar member={member} className="size-10 shrink-0 text-base" />
                <span className="min-w-0">
                  <span className="block truncate font-bold">{member.name}</span>
                  {member.roles.length > 0 ? (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {member.roles.map((role) => (
                        <Badge key={role} variant="unstyled" size="sm" className="border-border bg-muted px-2 text-[0.6875rem] text-foreground">
                          {ROLE_LABELS[role]}
                        </Badge>
                      ))}
                    </span>
                  ) : (
                    member.title && <span className="block text-xs text-muted-foreground">{member.title}</span>
                  )}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
