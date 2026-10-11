"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteNovelImage } from "./actions";

const LABELS = { background: "l’arrière-plan", logo: "le logo" } as const;

// Retire l’arrière-plan ou le logo d’un novel, après confirmation.
export function DeleteNovelImageButton({ novelId, kind }: { novelId: number; kind: "background" | "logo" }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
      onClick={() => {
        if (!confirm(`Supprimer ${LABELS[kind]} ? Cette action est définitive.`)) return;
        startTransition(async () => {
          const result = await deleteNovelImage(novelId, kind);
          if (result.error) toast.error(result.error);
          else toast.success("Image supprimée.");
        });
      }}
    >
      <Trash2 className="size-3.5" /> {pending ? "Suppression…" : "Supprimer"}
    </button>
  );
}
