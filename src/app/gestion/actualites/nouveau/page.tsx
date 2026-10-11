import type { Metadata } from "next";
import { Suspense } from "react";
import { ManageHeader, panel } from "@/components/manage-header";
import { TeamGate } from "@/components/team-gate";
import { NewsForm } from "../news-form";

export const metadata: Metadata = { title: "Nouvelle actualité" };

export default function NewNewsPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-muted" />}>
      <TeamGate>
        <ManageHeader back={{ href: "/gestion", label: "Gestion" }} title="Nouvelle actualité" />
        <div className={`mt-8 max-w-4xl ${panel}`}>
          <NewsForm news={{ title: "", content: "", published: false }} />
        </div>
      </TeamGate>
    </Suspense>
  );
}
