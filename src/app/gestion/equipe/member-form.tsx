"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LINK_KINDS, LINK_LABELS, type LinkKind } from "@/lib/team-links";
import { saveMember, type ActionResult } from "./actions";

type MemberFields = {
  id?: number;
  name: string;
  roles: string[];
  projects: string[];
  links: Partial<Record<LinkKind, string>>;
  position: number;
};

export function MemberForm({ member }: { member: MemberFields }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(saveMember, {});
  const [name, setName] = useState(member.name);
  const [roles, setRoles] = useState(member.roles.join("\n"));
  const [projects, setProjects] = useState(member.projects.join("\n"));
  const [position, setPosition] = useState(String(member.position));
  const [links, setLinks] = useState(member.links);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.savedAt) toast.success("Membre enregistré.");
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      {member.id && <input type="hidden" name="id" value={member.id} />}

      <div className="grid gap-6 sm:grid-cols-[1fr_8rem]">
        <div className="space-y-2">
          <Label htmlFor="name">Nom</Label>
          <Input id="name" name="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="position">Ordre</Label>
          <Input id="position" name="position" type="number" min={0} required value={position} onChange={(e) => setPosition(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="roles">Rôles</Label>
          <Textarea
            id="roles"
            name="roles"
            rows={5}
            value={roles}
            onChange={(e) => setRoles(e.target.value)}
            placeholder={"Traduction (JA → FR)\nSite Internet"}
            className="field-sizing-fixed"
          />
          <p className="text-xs text-muted-foreground">Un rôle par ligne. Le premier s’affiche sous le nom.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="projects">Projets</Label>
          <Textarea
            id="projects"
            name="projects"
            rows={5}
            value={projects}
            onChange={(e) => setProjects(e.target.value)}
            placeholder={"CHAOS;CHILD\nRance 01"}
            className="field-sizing-fixed"
          />
          <p className="text-xs text-muted-foreground">Un projet par ligne.</p>
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Liens (facultatifs)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {LINK_KINDS.map((kind) => (
            <div key={kind} className="space-y-1.5">
              <Label htmlFor={`link_${kind}`} className="text-xs text-muted-foreground">
                {LINK_LABELS[kind]}
              </Label>
              <Input
                id={`link_${kind}`}
                name={`link_${kind}`}
                type="url"
                placeholder="https://…"
                value={links[kind] ?? ""}
                onChange={(e) => setLinks((current) => ({ ...current, [kind]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="pill" disabled={pending}>
        {pending ? "Enregistrement…" : member.id ? "Enregistrer" : "Ajouter le membre"}
      </Button>
    </form>
  );
}
