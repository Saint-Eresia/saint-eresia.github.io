"use client";

import Link from "next/link";
import { useState } from "react";
import type { VolumeIllustration } from "@/lib/novels";
import { ImageLightbox } from "../../[chapitre]/image-lightbox";

// Grille des illustrations : un clic ouvre la visionneuse (← / → pour parcourir), le lien mène au chapitre.
export function IllustrationGallery({ novelSlug, images }: { novelSlug: string; images: VolumeIllustration[] }) {
  const [zoomed, setZoomed] = useState<number | null>(null);
  return (
    <>
      <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((image, index) => (
          <li key={image.src + index} className="overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => setZoomed(index)}
              aria-label={`Agrandir l’illustration ${index + 1}`}
              className="block aspect-[3/4] w-full overflow-hidden bg-muted"
            >
              <img src={image.src} alt={image.alt} loading="lazy" className="h-full w-full object-cover transition-transform hover:scale-[1.03]" />
            </button>
            <div className="space-y-0.5 px-3 py-2 text-xs">
              <Link href={`/novels/${novelSlug}/${image.chapter.slug}`} className="line-clamp-2 font-semibold hover:text-primary">
                {image.chapter.heading}
              </Link>
              {image.credit && <p className="text-muted-foreground">{image.credit}</p>}
            </div>
          </li>
        ))}
      </ul>
      <ImageLightbox images={images} index={zoomed} onChange={setZoomed} />
    </>
  );
}
