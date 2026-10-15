"use client";

import { Plus, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/lightswind/table";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { ROLES, type RoleKey } from "@/lib/roles";
import { cn } from "@/lib/utils";

type Member = { id: number; name: string; avatarFile: string };
type Row = { memberId: number; roles: RoleKey[] };

type RoleOption = { key: RoleKey; label: string; short: string };
const NOUNS = { patch: "ce patch", novel: "ce novel" } as const;
const TEAMS = { patch: "l’équipe du patch", novel: "l’équipe du novel" } as const;

// Tableau membres × rôles d’un patch ou d’un novel : ajouter un membre, cocher ses rôles, enregistrer.
// `roles` : colonnes proposées (toute la liste pour un patch, NOVEL_ROLES pour un novel).
export function TeamEditor({
  project,
  roles = ROLES,
  team,
  initial,
  save,
}: {
  project: keyof typeof NOUNS;
  roles?: readonly RoleOption[];
  team: Member[];
  initial: Row[];
  save: (entries: Row[]) => Promise<{ error?: string }>;
}) {
  const [rows, setRows] = useState(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [toAdd, setToAdd] = useState("");
  const [pending, startTransition] = useTransition();
  const byId = useMemo(() => new Map(team.map((member) => [member.id, member])), [team]);
  const available = team.filter((member) => !rows.some((row) => row.memberId === member.id));
  const dirty = JSON.stringify(rows) !== saved;

  function toggle(memberId: number, role: RoleKey) {
    setRows((current) =>
      current.map((row) =>
        row.memberId !== memberId
          ? row
          : {
              ...row,
              roles: row.roles.includes(role)
                ? row.roles.filter((r) => r !== role)
                : ROLES.map((r) => r.key).filter((key) => key === role || row.roles.includes(key)),
            },
      ),
    );
  }

  function add() {
    const id = Number(toAdd);
    if (!id || rows.some((row) => row.memberId === id)) return;
    setRows((current) => [...current, { memberId: id, roles: [] }]);
    setToAdd("");
  }

  return (
    <div className="space-y-4">
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong p-6 text-center text-sm text-muted-foreground">
          Aucun membre sur {NOUNS[project]}. Ajoutez-en un ci-dessous.
        </p>
      ) : (
        <Table dense style={{ minWidth: `${14 + roles.length * 4.2}rem` }}>
          <TableCaption className="sr-only">Rôles des membres sur {NOUNS[project]}</TableCaption>
          <TableHeader className="bg-secondary">
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="sticky left-0 bg-secondary text-sm text-foreground">
                Membre
              </TableHead>
              {roles.map((role) => (
                <TableHead key={role.key} scope="col" align="center" className="px-1.5">
                  <abbr title={role.label} className="no-underline">
                    {role.short}
                  </abbr>
                </TableHead>
              ))}
              <TableHead scope="col" className="px-2">
                <span className="sr-only">Retirer</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const member = byId.get(row.memberId);
              if (!member) return null;
              return (
                <TableRow key={row.memberId} className="hover:bg-muted/40">
                  <TableHead scope="row" className="sticky left-0 bg-background text-sm text-foreground">
                    <span className="flex items-center gap-2.5">
                      <MemberAvatar member={member} className="size-7 text-xs" />
                      {member.name}
                    </span>
                  </TableHead>
                  {roles.map((role) => (
                    <TableCell key={role.key} align="center" className="px-1.5">
                      <input
                        type="checkbox"
                        checked={row.roles.includes(role.key)}
                        onChange={() => toggle(row.memberId, role.key)}
                        aria-label={`${member.name} : ${role.label}`}
                        className="size-4 cursor-pointer accent-[var(--primary)]"
                      />
                    </TableCell>
                  ))}
                  <TableCell align="center" className="px-2">
                    <button
                      type="button"
                      onClick={() => setRows((current) => current.filter((r) => r.memberId !== row.memberId))}
                      aria-label={`Retirer ${member.name} de ${TEAMS[project]}`}
                      className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="ajout-membre" className="text-xs font-semibold text-muted-foreground">
            Ajouter un membre
          </label>
          <div className="flex gap-2">
            <select
              id="ajout-membre"
              value={toAdd}
              onChange={(e) => setToAdd(e.target.value)}
              disabled={available.length === 0}
              className="h-9 min-w-48 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="">{available.length ? "Choisir…" : "Tous les membres sont ajoutés"}</option>
              {available.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
            <Button type="button" variant="outline" onClick={add} disabled={!toAdd}>
              <Plus /> Ajouter
            </Button>
          </div>
        </div>
        <Button
          type="button"
          size="pill"
          className={cn("ml-auto")}
          disabled={!dirty || pending}
          onClick={() =>
            startTransition(async () => {
              const result = await save(rows);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              setSaved(JSON.stringify(rows));
              toast.success(project === "novel" ? "Équipe du novel enregistrée." : "Équipe du patch enregistrée.");
            })
          }
        >
          {pending ? "Enregistrement…" : "Enregistrer l’équipe"}
        </Button>
      </div>
    </div>
  );
}
