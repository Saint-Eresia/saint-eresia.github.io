import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TeamGate } from "@/components/team-gate";
import { STATUSES } from "@/lib/patches";
import { PatchForm } from "../patch-form";

export const metadata: Metadata = { title: "Nouveau patch" };

export default function NewPatchPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <TeamGate>
        <Link href="/gestion" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="size-4" /> Gestion des patchs
        </Link>
        <h1 className="mt-4 mb-8 text-3xl font-extrabold tracking-tight">Nouveau patch</h1>
        <div className="max-w-3xl rounded-2xl border border-border bg-card p-6 sm:p-8">
          <PatchForm
            statuses={STATUSES}
            patch={{ title: "", description: "", status: "En développement", progress: 0, downloadUrl: "", steps: [] }}
          />
          <p className="mt-6 text-sm text-muted-foreground">
            Vous pourrez ajouter la couverture et les captures d’écran une fois le patch créé.
          </p>
        </div>
      </TeamGate>
    </Suspense>
  );
}
