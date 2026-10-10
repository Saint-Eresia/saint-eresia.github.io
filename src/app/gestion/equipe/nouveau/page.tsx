import type { Metadata } from "next";
import { Suspense } from "react";
import { ManageHeader, panel } from "@/components/manage-header";
import { TeamGate } from "@/components/team-gate";
import { listTeam } from "@/lib/team";
import { MemberForm } from "../member-form";

export const metadata: Metadata = { title: "Nouveau membre" };

export default function NewMemberPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <TeamGate>
        <NewMember />
      </TeamGate>
    </Suspense>
  );
}

async function NewMember() {
  const team = await listTeam();
  const nextPosition = Math.max(0, ...team.map((m) => m.position)) + 1;
  return (
    <>
      <ManageHeader back={{ href: "/gestion", label: "Gestion" }} title="Nouveau membre" />
      <div className={`mt-8 max-w-3xl ${panel}`}>
        <MemberForm member={{ name: "", roles: [], projects: [], links: {}, position: nextPosition }} />
        <p className="mt-6 text-sm text-muted-foreground">Vous pourrez ajouter son avatar une fois le membre créé.</p>
      </div>
    </>
  );
}
