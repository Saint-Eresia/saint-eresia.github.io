"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useCallback, useState } from "react";

export type GalleryImage = { src: string; alt: string; width: number; height: number };

// Vignettes, puis visionneuse plein écran (flèches du clavier, Échap pour fermer).
export function Gallery({ images }: { images: GalleryImage[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const count = images.length;
  const go = useCallback((step: number) => setIndex((i) => (i === null ? i : (i + step + count) % count)), [count]);
  const current = index === null ? null : images[index];

  return (
    <>
      <ul className="grid grid-cols-2 gap-3">
        {images.map((image, i) => (
          <li key={image.src}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Agrandir : ${image.alt}`}
              className="group block aspect-video w-full overflow-hidden rounded-xl border border-border bg-overlay transition-[border-color] hover:border-primary/60 focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              <img
                src={image.src}
                alt={image.alt}
                width={image.width}
                height={image.height}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>

      <DialogPrimitive.Root open={index !== null} onOpenChange={(open) => !open && setIndex(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-open:animate-in data-open:fade-in-0" />
          <DialogPrimitive.Content
            className="fixed inset-0 z-50 flex flex-col outline-none data-open:animate-in data-open:fade-in-0"
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") go(1);
              if (event.key === "ArrowLeft") go(-1);
            }}
          >
            <DialogPrimitive.Title className="sr-only">Galerie d’images</DialogPrimitive.Title>
            {current && (
              <>
                <div className="relative flex min-h-0 flex-1 items-center justify-center p-4 sm:px-20">
                  <img
                    key={current.src}
                    src={current.src}
                    alt={current.alt}
                    width={current.width}
                    height={current.height}
                    className="max-h-full max-w-full rounded-lg object-contain shadow-2xl animate-in fade-in-0 zoom-in-[0.98] duration-300"
                  />
                  {count > 1 && (
                    <>
                      <NavButton label="Image précédente" className="left-3" onClick={() => go(-1)}>
                        <ChevronLeft className="size-6" />
                      </NavButton>
                      <NavButton label="Image suivante" className="right-3" onClick={() => go(1)}>
                        <ChevronRight className="size-6" />
                      </NavButton>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-center gap-3 px-4 pt-2 pb-6 text-sm text-on-overlay/70">
                  <span className="rounded-full bg-on-overlay/10 px-2.5 py-0.5 font-semibold tabular-nums text-on-overlay">
                    {index! + 1} / {count}
                  </span>
                  <DialogPrimitive.Description>{current.alt || "Capture d’écran"}</DialogPrimitive.Description>
                </div>
              </>
            )}
            <DialogPrimitive.Close
              className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-on-overlay/10 px-4 py-2 text-sm font-semibold text-on-overlay/85 transition-colors hover:bg-on-overlay/20 hover:text-on-overlay focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none"
            >
              <X className="size-4" /> Fermer
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

function NavButton({
  label,
  className,
  onClick,
  children,
}: {
  label: string;
  className: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`absolute top-1/2 grid size-12 -translate-y-1/2 place-items-center rounded-full bg-on-overlay/10 text-on-overlay/85 transition-colors hover:bg-on-overlay/20 hover:text-on-overlay focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none ${className}`}
    >
      {children}
    </button>
  );
}
