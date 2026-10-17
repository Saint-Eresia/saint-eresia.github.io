"use client";

import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { focusSnapshot, subscribe } from "./[chapitre]/reader-panel";

// Mode lecture : pose data-reader-mode="focus" sur <html> (la feuille de style masque alors l’en-tête et le pied
// du site) tant qu’on est sur un chapitre. Placé dans la mise en page du novel, qui reste en place d’un chapitre
// à l’autre : l’en-tête ne réapparaît pas le temps du chargement du chapitre suivant.
export function FocusSync() {
  const pathname = usePathname();
  const focus = useSyncExternalStore(subscribe, focusSnapshot, () => false);
  const onChapter = /^\/novels\/[^/]+\/[^/]+$/.test(pathname);

  useEffect(() => {
    const root = document.documentElement;
    if (focus && onChapter) root.dataset.readerMode = "focus";
    else delete root.dataset.readerMode;
  }, [focus, onChapter]);
  useEffect(() => () => void delete document.documentElement.dataset.readerMode, []);
  return null;
}
