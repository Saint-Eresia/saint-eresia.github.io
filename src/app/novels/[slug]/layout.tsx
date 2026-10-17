import { Suspense } from "react";
import { FocusSync } from "./focus-sync";

// Mise en page commune à la fiche d’un novel et à ses chapitres : seulement le suivi du mode lecture.
export default function NovelLayout({ children }: LayoutProps<"/novels/[slug]">) {
  return (
    <>
      {children}
      {/* usePathname() lit l’adresse : à isoler dans un Suspense (rendu partiel de Next). */}
      <Suspense fallback={null}>
        <FocusSync />
      </Suspense>
    </>
  );
}
