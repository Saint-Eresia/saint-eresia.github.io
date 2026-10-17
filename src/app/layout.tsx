import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { siteUrl } from "@/lib/site-url";
import "./globals.css";

const urbanist = Urbanist({ variable: "--font-urbanist", subsets: ["latin"] });

export const metadata: Metadata = {
  // Base des adresses absolues des aperçus de partage (Open Graph).
  metadataBase: new URL(siteUrl()),
  openGraph: { siteName: "Saint Eresia", locale: "fr_FR", type: "website" },
  title: { default: "Saint Eresia — Light novels et patchs VN en français", template: "%s · Saint Eresia" },
  description: "Saint Eresia traduit des light novels, à lire en ligne, et publie des patchs français pour visual novels.",
  // Flux RSS (nouveaux chapitres et actualités), détecté par les lecteurs de flux.
  alternates: { types: { "application/rss+xml": [{ url: "/feed.xml", title: "Saint Eresia — nouveautés" }] } },
};

// Thème appliqué avant le premier affichage (pas de flash) : choix mémorisé sous la clé "theme" par le bouton
// de l’en-tête, sinon la préférence du système. Même mécanisme que src/components/lightswind/toggle-theme.tsx.
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // La classe .dark est posée par le script avant l’hydratation : React ne doit pas signaler l’écart.
    <html lang="fr" className={urbanist.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#contenu"
          className="sr-only z-50 rounded-full bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Aller au contenu
        </a>
        <SiteHeader />
        <main id="contenu" className="flex-1">
          {children}
        </main>
        <footer data-site-chrome className="mt-20 border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="font-semibold text-foreground">Saint Eresia</span>
              <Link href="/a-propos" className="hover:text-foreground hover:underline">
                À propos
              </Link>
              <Link href="/plus" className="hover:text-foreground hover:underline">
                Outils
              </Link>
              <a href="/feed.xml" className="hover:text-foreground hover:underline">
                Flux RSS
              </a>
            </p>
            <p>Les œuvres originales appartiennent à leurs ayants droit. Nous encourageons leur achat.</p>
          </div>
        </footer>
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
