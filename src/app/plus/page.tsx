import { BookOpen, CalendarDays, Camera, Code, Download, ExternalLink, Image as ImageIcon, MonitorSmartphone, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageIntro } from "@/components/page-intro";
import { Button } from "@/components/ui/button";
import { listTeam, memberAnchor } from "@/lib/team";

export const metadata: Metadata = {
  title: "Plus",
  description: "Les outils de l’équipe Saint Eresia : Shiori RPC, votre visual novel en statut Discord, et Gllia, le launcher de nos patchs.",
};

// Shiori RPC (anciennement VNRPC) : dépôt et documentation renommés.
const SHIORI = {
  repo: "https://github.com/lennmoe/shiori",
  download: "https://github.com/lennmoe/shiori/releases/latest",
  docs: "https://shioridocs.vercel.app/install/",
};

// Gllia : pas encore de version publique (dépôt privé) ; le bouton de téléchargement reste désactivé d’ici là.
const GLLIA_FEATURES = [
  "Tous nos patchs au même endroit, avec leur avancement.",
  "Retrouve tout seul vos jeux installés sur Steam et GOG, ou le dossier que vous lui indiquez.",
  "Installe le patch en un clic, y compris depuis le bouton « Télécharger via Gllia » des fiches du site.",
];

const FEATURES = [
  { icon: MonitorSmartphone, title: "Détection automatique", body: "Ren’Py, KiriKiri, SiglusEngine, Unity… ou choix manuel de la fenêtre du jeu." },
  { icon: BookOpen, title: "Chapitre et route", body: "Lus dans le titre de la fenêtre, en français, en anglais ou en japonais." },
  { icon: CalendarDays, title: "Temps de lecture", body: "Historique par jour, calendrier de lecture et progression comparée à la durée moyenne VNDB." },
  { icon: ImageIcon, title: "Bibliothèque et couvertures", body: "Couvertures VNDB, page par visual novel, synchronisation de votre liste VNDB." },
  { icon: Camera, title: "Captures d’écran", body: "Une touche pour capturer le jeu, avec une galerie et une carte « ma semaine » à partager." },
  { icon: ShieldCheck, title: "Confidentialité", body: "Niveau de partage réglable par jeu ; les couvertures NSFW restent floutées et hors de Discord." },
];

export default function PlusPage() {
  return (
    <>
      <PageIntro eyebrow="Plus" title="Les outils de l’équipe">
        Ce que nos membres développent à côté des traductions.
      </PageIntro>

      <section aria-labelledby="shiori" className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center">
          <div>
            <p className="text-xs font-extrabold tracking-[0.14em] text-primary uppercase">Discord Rich Presence</p>
            <h2 id="shiori" className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              Shiori RPC
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Un outil de{" "}
              <Suspense fallback="len.">
                <Author />
              </Suspense>
              , développeur de l’équipe.
            </p>
            <p className="mt-5 text-lg leading-relaxed">
              Affichez le visual novel que vous lisez en statut Discord : le titre, le chapitre ou la route en cours, le temps de
              lecture et la couverture.
            </p>
            <p className="mt-3 text-muted-foreground">
              Une petite application Windows (10 ou 11) dans la zone de notification, avec en plus une bibliothèque et un suivi
              du temps de lecture.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="pill">
                <a href={SHIORI.download} target="_blank" rel="noopener noreferrer">
                  <Download /> Télécharger
                </a>
              </Button>
              <Button asChild size="pill" variant="outline">
                <a href={SHIORI.repo} target="_blank" rel="noopener noreferrer">
                  <Code /> Code source
                </a>
              </Button>
              <Button asChild size="pill" variant="ghost">
                <a href={SHIORI.docs} target="_blank" rel="noopener noreferrer">
                  Guide d’installation <ExternalLink />
                </a>
              </Button>
            </div>
            <figure className="mt-8 w-fit max-w-full">
              <img
                src="/plus/vnrpc-discord-status.webp"
                alt="Statut Discord affiché par Shiori RPC : « Subarashiki Hibi », lecture de la route Wonderful Everyday, 35 h 05 de lecture au total."
                width={418}
                height={141}
                className="max-w-full rounded-xl border border-border"
              />
              <figcaption className="mt-2 text-xs text-muted-foreground">Ce que voient vos amis sur Discord.</figcaption>
            </figure>
          </div>

          <figure>
            <img
              src="/plus/vnrpc-now-reading.webp"
              alt="Fenêtre « Now reading » de Shiori RPC : couverture du jeu en cours, route, temps de lecture et aperçu du statut Discord."
              width={1400}
              height={887}
              className="w-full rounded-2xl border border-border shadow-[0_24px_60px_var(--shadow)]"
            />
          </figure>
        </div>

        <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-2xl border border-border bg-card p-5">
              <Icon className="size-5 text-primary" aria-hidden />
              <h3 className="mt-3 font-bold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>

        <div className="mt-14 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center">
          <figure>
            <img
              src="/plus/vnrpc-library.webp"
              alt="Bibliothèque de Shiori RPC avec le calendrier de lecture."
              width={1400}
              height={887}
              loading="lazy"
              className="w-full rounded-2xl border border-border"
            />
          </figure>
          <div className="rounded-2xl border border-border bg-card p-6">
            <h3 className="text-lg font-bold">Installation</h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground marker:font-bold marker:text-primary">
              <li>
                Téléchargez <code className="rounded bg-muted px-1.5 py-0.5 text-sm text-foreground">shiori_setup.exe</code>{" "}
                depuis la{" "}
                <a href={SHIORI.download} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">
                  dernière version
                </a>{" "}
                et lancez-le.
              </li>
              <li>
                Gardez l’application Discord ouverte, avec le partage des activités détectées activé (paramètres Discord,
                rubrique <em>Confidentialité des activités</em>).
              </li>
              <li>Lancez votre visual novel : il est détecté tout seul.</li>
            </ol>
            <p className="mt-4 text-xs text-muted-foreground">
              Les couvertures et captures de jeux montrées ici appartiennent à VNDB et aux éditeurs.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="gllia" className="mx-auto mt-20 max-w-6xl border-t border-border px-4 pt-14 sm:px-6">
        <div className="max-w-2xl">
          <p className="text-xs font-extrabold tracking-[0.14em] text-primary uppercase">Launcher</p>
          <h2 id="gllia" className="mt-3">
            {/* logo-clair.png est le logo noir (pour fond clair), logo-sombre.png le blanc (pour fond sombre). */}
            <img src="/gllia/logo-clair.png" alt="Gllia" width={389} height={160} className="h-12 w-auto dark:hidden" />
            <img src="/gllia/logo-sombre.png" alt="" aria-hidden width={389} height={160} className="hidden h-12 w-auto dark:block" />
          </h2>
          <p className="mt-5 text-lg leading-relaxed">
            Le launcher de nos patchs : choisissez un jeu, Gllia retrouve son dossier et installe la traduction française.
          </p>
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-muted-foreground marker:text-primary">
            {GLLIA_FEATURES.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">Application Windows (10 ou 11).</p>
          <Button size="pill" className="mt-6" disabled>
            Bientôt disponible
          </Button>
        </div>
      </section>
    </>
  );
}

// Lien vers la présentation de l’auteur sur la page Équipe, s’il y figure.
async function Author() {
  const len = (await listTeam()).find((member) => member.name.toLowerCase().replace(/\.$/, "") === "len");
  if (!len) return <>len.</>;
  return (
    <Link href={`/equipe#${memberAnchor(len)}`} className="font-semibold text-primary hover:underline">
      {len.name}
    </Link>
  );
}
