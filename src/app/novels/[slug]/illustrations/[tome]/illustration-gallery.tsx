"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { deleteIllustration } from "@/app/gestion/novels/actions";
import { ConfirmDelete } from "@/components/confirm-delete";
import type { VolumeIllustration } from "@/lib/novels";
import { ImageLightbox } from "../../[chapitre]/image-lightbox";

// Grille des illustrations : un clic ouvre la visionneuse (← / → pour parcourir), le lien mène au chapitre.
// Avec novelId (équipe), chaque illustration peut être retirée de son chapitre.
export function IllustrationGallery({
  novelId,
  novelSlug,
  images,
}: {
  novelId?: number;
  novelSlug: string;
  images: VolumeIllustration[];
}) {
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
              {novelId !== undefined && (
                <div className="pt-1.5">
                  <ConfirmDelete
                    size="sm"
                    label="Supprimer"
                    title="Supprimer cette illustration ?"
                    description={`Elle sera retirée du texte de « ${image.chapter.heading} », avec sa ligne de crédit. Le fichier est supprimé s’il ne sert dans aucun autre chapitre.`}
                    action={async () => {
                      const result = await deleteIllustration(novelId, image.chapter.slug, image.src);
                      if (!result.error) toast.success("Illustration supprimée.");
                      return result;
                    }}
                  />
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      <ImageLightbox images={images} index={zoomed} onChange={setZoomed} />
    </>
  );
}
