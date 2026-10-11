"use client";

import { Trash2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteNovelBackground } from "./actions";

// Retire l’arrière-plan d’un novel, après confirmation.
export function DeleteBackgroundButton({ novelId }: { novelId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
      onClick={() => {
        if (!confirm("Supprimer l’arrière-plan ? Cette action est définitive.")) return;
        startTransition(async () => {
          const result = await deleteNovelBackground(novelId);
          if (result.error) toast.error(result.error);
          else toast.success("Arrière-plan supprimé.");
        });
      }}
    >
      <Trash2 className="size-3.5" /> {pending ? "Suppression…" : "Supprimer"}
    </button>
  );
}
