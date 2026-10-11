"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Member = { id: number; name: string; avatarFile: string; role: string };

// Choix des membres de l’équipe affichés sur la fiche d’un patch ou d’un novel.
export function MemberPicker({
  members,
  selected,
  save,
}: {
  members: Member[];
  selected: number[];
  save: (memberIds: number[]) => Promise<{ error?: string }>;
}) {
  const [chosen, setChosen] = useState(() => new Set(selected));
  const [saved, setSaved] = useState(() => new Set(selected));
  const [pending, startTransition] = useTransition();
  const dirty = chosen.size !== saved.size || [...chosen].some((id) => !saved.has(id));

  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">Ajoutez d’abord des membres dans la gestion de l’équipe.</p>;
  }

  function toggle(id: number) {
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <ul className="grid gap-2 sm:grid-cols-2">
        {members.map((member) => {
          const checked = chosen.has(member.id);
          return (
            <li key={member.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 transition-colors",
                  checked ? "border-primary/60 bg-primary/10" : "border-border hover:bg-muted",
                )}
              >
                <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(member.id)} />
                <MemberAvatar member={member} className="size-8 text-sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{member.name}</span>
                  {member.role && <span className="block truncate text-xs text-muted-foreground">{member.role}</span>}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "grid size-5 shrink-0 place-items-center rounded-md border",
                    checked ? "border-primary bg-primary text-white" : "border-border",
                  )}
                >
                  {checked && <Check className="size-3.5" />}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <Button
        type="button"
        size="pill"
        disabled={!dirty || pending}
        onClick={() =>
          startTransition(async () => {
            const ids = [...chosen];
            const result = await save(ids);
            if (result.error) {
              toast.error(result.error);
              return;
            }
            setSaved(new Set(ids));
            toast.success("Équipe enregistrée.");
          })
        }
      >
        {pending ? "Enregistrement…" : "Enregistrer l’équipe"}
      </Button>
    </div>
  );
}
