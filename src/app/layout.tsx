import type { Metadata } from "next";
import { Urbanist } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const urbanist = Urbanist({ variable: "--font-urbanist", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Saint Eresia — Light novels et patchs VN en français", template: "%s · Saint Eresia" },
  description: "Saint Eresia traduit des light novels, à lire en ligne, et publie des patchs français pour visual novels.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`dark ${urbanist.variable}`} data-scroll-behavior="smooth">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#contenu"
          className="sr-only z-50 rounded-full bg-primary px-4 py-2 text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Aller au contenu
        </a>
        <SiteHeader />
        <main id="contenu" className="flex-1">
          {children}
        </main>
        <footer className="mt-20 border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p className="font-semibold text-foreground">Saint Eresia</p>
            <p>Les œuvres originales appartiennent à leurs ayants droit. Nous encourageons leur achat.</p>
          </div>
        </footer>
        <Toaster theme="dark" position="bottom-center" />
      </body>
    </html>
  );
}
