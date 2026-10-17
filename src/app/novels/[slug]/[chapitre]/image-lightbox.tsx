"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect } from "react";

// Illustration du chapitre en plein écran. ← / → : image précédente / suivante ; Échap ou clic sur le fond : fermer.
export function ImageLightbox({
  images,
  index,
  onChange,
}: {
  images: { src: string; alt: string }[];
  index: number | null;
  onChange: (index: number | null) => void;
}) {
  const open = index !== null && images[index] !== undefined;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChange(null);
      else if (e.key === "ArrowLeft" && index > 0) onChange(index - 1);
      else if (e.key === "ArrowRight" && index < images.length - 1) onChange(index + 1);
      else return;
      e.preventDefault();
      // Les flèches ne doivent pas aussi changer de chapitre.
      e.stopImmediatePropagation();
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey, { capture: true });
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey, { capture: true });
    };
  }, [open, index, images.length, onChange]);

  if (!open) return null;
  const image = images[index];
  const arrow =
    "absolute top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-[var(--on-overlay)] transition-colors hover:bg-black/75";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Illustration ${index + 1} sur ${images.length}`}
      className="fixed inset-0 z-[60] grid place-items-center bg-black/90 p-4 backdrop-blur-sm"
      onClick={() => onChange(null)}
    >
      <img
        src={image.src}
        alt={image.alt}
        // Agrandie pour remplir l’écran (object-contain) ; un clic hors de l’image elle-même ferme.
        className="h-[92vh] w-[94vw] object-contain"
        onClick={(e) => {
          if (insideImage(e.currentTarget, e.clientX, e.clientY)) e.stopPropagation();
        }}
      />
      <p className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-sm font-semibold text-[var(--on-overlay)]">
        {index + 1} / {images.length}
      </p>
      <button
        type="button"
        autoFocus
        aria-label="Fermer"
        onClick={() => onChange(null)}
        className="absolute top-3 right-3 grid size-11 place-items-center rounded-full bg-black/50 text-[var(--on-overlay)] transition-colors hover:bg-black/75"
      >
        <X className="size-5" />
      </button>
      {index > 0 && (
        <button
          type="button"
          aria-label="Illustration précédente"
          onClick={(e) => {
            e.stopPropagation();
            onChange(index - 1);
          }}
          className={`${arrow} left-3`}
        >
          <ChevronLeft className="size-6" />
        </button>
      )}
      {index < images.length - 1 && (
        <button
          type="button"
          aria-label="Illustration suivante"
          onClick={(e) => {
            e.stopPropagation();
            onChange(index + 1);
          }}
          className={`${arrow} right-3`}
        >
          <ChevronRight className="size-6" />
        </button>
      )}
    </div>
  );
}

// Le clic tombe-t-il sur l’image affichée, et non sur les bandes vides laissées par object-contain ?
function insideImage(img: HTMLImageElement, x: number, y: number) {
  const box = img.getBoundingClientRect();
  if (!img.naturalWidth || !img.naturalHeight) return true;
  const scale = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
  const [width, height] = [img.naturalWidth * scale, img.naturalHeight * scale];
  const [left, top] = [box.left + (box.width - width) / 2, box.top + (box.height - height) / 2];
  return x >= left && x <= left + width && y >= top && y <= top + height;
}
