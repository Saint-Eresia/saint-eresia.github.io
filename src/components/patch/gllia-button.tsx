"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

// « Télécharger via Gllia » : le lien gllia://installer/<slug> ouvre le launcher, qui télécharge
// et lance l’installeur du patch (voir EresiaLauncher/src/link.rs).
// Le navigateur ne dit pas si un programme gère ce lien. Quand Gllia est installé, il demande
// « Ouvrir Gllia ? » et la page perd le focus ; sinon rien ne se passe, et après ce délai on
// ouvre la page de téléchargement du patch.
const GLLIA_TIMEOUT_MS = 1500;

// Chaque clic (Gllia ou lien direct) est signalé au site pour le compteur de téléchargements de la fiche ;
// sendBeacon part même si la page est quittée aussitôt.
function countDownload(id: number) {
  try {
    navigator.sendBeacon(`/api/patches/${id}/telechargement`);
  } catch {}
}

export function GlliaButton({ id, slug, downloadUrl }: { id: number; slug: string; downloadUrl: string }) {
  function openGllia(event: React.MouseEvent<HTMLAnchorElement>) {
    countDownload(id);
    // Gllia n’existe que sous Windows ; Ctrl/Maj+clic garde le comportement d’un lien.
    if (!/Windows/.test(navigator.userAgent) || event.ctrlKey || event.shiftKey || event.metaKey) return;
    event.preventDefault();

    let opened = false;
    const onLeave = () => {
      opened = true;
    };
    window.addEventListener("blur", onLeave, { once: true });
    document.addEventListener("visibilitychange", onLeave, { once: true });
    window.setTimeout(() => {
      window.removeEventListener("blur", onLeave);
      document.removeEventListener("visibilitychange", onLeave);
      if (!opened) window.location.assign(downloadUrl);
    }, GLLIA_TIMEOUT_MS);

    window.location.href = `gllia://installer/${slug}`;
  }

  return (
    <Button asChild size="pill" className="w-full">
      <a href={downloadUrl} onClick={openGllia} onAuxClick={(event) => event.button === 1 && countDownload(id)}>
        <Download /> Télécharger via
        {/* Logo noir sur le rose clair du thème sombre, blanc sur le rose foncé du thème clair. */}
        <img src="/gllia/logo-sombre.png" alt="Gllia" width={389} height={160} className="h-5 w-auto dark:hidden" />
        <img src="/gllia/logo-clair.png" alt="Gllia" width={389} height={160} className="hidden h-5 w-auto dark:block" />
      </a>
    </Button>
  );
}
