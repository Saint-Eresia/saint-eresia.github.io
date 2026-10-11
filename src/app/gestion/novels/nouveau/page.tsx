import type { Metadata } from "next";
import { Suspense } from "react";
import { ManageHeader, panel } from "@/components/manage-header";
import { TeamGate } from "@/components/team-gate";
import { NOVEL_STATUSES } from "@/lib/novels";
import { NovelForm } from "../novel-form";

export const metadata: Metadata = { title: "Nouveau novel" };

export default function NewNovelPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <TeamGate>
        <ManageHeader back={{ href: "/gestion", label: "Gestion" }} title="Nouveau light novel" />
        <div className={`mt-8 max-w-3xl ${panel}`}>
          <NovelForm
            statuses={NOVEL_STATUSES}
            novel={{ title: "", originalTitle: "", author: "", artist: "", status: "En cours", synopsis: "", quote: "", featured: "0" }}
          />
          <p className="mt-6 text-sm text-muted-foreground">
            Vous pourrez ajouter la couverture, les tomes et les chapitres une fois le novel créé.
          </p>
        </div>
      </TeamGate>
    </Suspense>
  );
}
