"use client";

import { BookOpen, History } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { parseProgress, rawProgress, RESUME_HASH } from "@/lib/reading-progress";

const noop = () => () => {};

// « Commencer la lecture », ou « Reprendre la lecture » si ce navigateur a déjà lu un chapitre du novel
// (toujours publié : `chapters` liste les chapitres publics).
export function ResumeButton({ novelSlug, firstSlug, chapters }: { novelSlug: string; firstSlug: string; chapters: string[] }) {
  // Lu côté client ; côté serveur (et avant hydratation), pas de reprise.
  const progress = parseProgress(useSyncExternalStore(noop, () => rawProgress(novelSlug), () => null));
  const resume = progress && chapters.includes(progress.slug) ? progress : null;

  if (!resume) {
    return (
      <Button asChild size="pill" className="w-full">
        <Link href={`/novels/${novelSlug}/${firstSlug}`}>
          <BookOpen /> Commencer la lecture
        </Link>
      </Button>
    );
  }
  return (
    <div className="space-y-2">
      <Button asChild size="pill" className="w-full">
        {/* scroll={false} : le lecteur fait lui-même défiler jusqu’au passage mémorisé. */}
        <Link href={`/novels/${novelSlug}/${resume.slug}${RESUME_HASH}`} scroll={false}>
          <History /> Reprendre la lecture
        </Link>
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {resume.heading}
        {resume.slug !== firstSlug && (
          <>
            {" · "}
            <Link href={`/novels/${novelSlug}/${firstSlug}`} className="font-semibold hover:text-foreground hover:underline">
              Recommencer au début
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
