import Link from "next/link";
import { MemberAvatar } from "@/components/member-avatar";
import { cn } from "@/lib/utils";

type Member = { id: number; name: string; avatarFile: string; roles: string[] };

// Carte « Équipe » d’une fiche : les membres qui ont participé au patch ou au novel.
// Chaque membre renvoie vers sa présentation sur la page Équipe.
export function ProjectMembers({ members, className }: { members: Member[]; className?: string }) {
  if (members.length === 0) return null;
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-6", className)} aria-labelledby="participants">
      <h2 id="participants" className="text-sm font-semibold text-muted-foreground">
        Équipe
      </h2>
      <ul className="mt-4 space-y-1">
        {members.map((member) => (
          <li key={member.id}>
            <Link
              href={`/equipe#membre-${member.id}`}
              className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted"
            >
              <MemberAvatar member={member} className="size-10 text-base" />
              <span className="min-w-0">
                <span className="block truncate font-bold">{member.name}</span>
                {member.roles[0] && <span className="block truncate text-xs text-muted-foreground">{member.roles[0]}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
