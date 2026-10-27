"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

// Mention d’un tome traduit à l’origine par une autre équipe et seulement ré-édité par Saint Eresia.
// Le bouton (i) ouvre l’explication ; un clic ailleurs ou Échap la referme.
export function ReeditBadge() {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={root} className="relative inline-flex items-center">
      <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold">
        Re:edit
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={id}
          aria-label="Qu’est-ce qu’une ré-édition ?"
          className="-mr-1 grid size-4 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary"
        >
          <Info className="size-3.5" />
        </button>
      </span>
      {open && (
        <span
          id={id}
          role="note"
          className="absolute top-full left-0 z-20 mt-2 w-72 rounded-lg border border-border bg-popover px-4 py-3 text-xs leading-relaxed font-normal text-popover-foreground shadow-[0_12px_40px_var(--shadow)]"
        >
          Ce tome a été traduit à l’origine par une autre équipe, créditée ci-dessous. Saint Eresia l’a ré-édité : harmonisation
          des noms et des termes avec le reste de la série, structure du texte retravaillée (dialogues, typographie), et
          cohérence d’ensemble.
        </span>
      )}
    </span>
  );
}
