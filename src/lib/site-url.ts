import type { Metadata } from "next";

// Adresse publique du site (liens absolus : annonces Discord, aperçus de partage, sitemap).
// SITE_URL si défini (domaine personnalisé), sinon le domaine de production Vercel, sinon le serveur local.
export function siteUrl() {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

// Flux RSS du site (nouveaux chapitres et actualités), annoncé dans l’en-tête des pages.
export const SITE_FEED = { url: "/feed.xml", title: "Saint Eresia — nouveautés" };

// Aperçu d’une page partagée sur Discord, X, etc. (Open Graph et carte Twitter).
// `large` : image paysage (arrière-plan) affichée en grand ; sinon vignette (couverture portrait).
export function socialMetadata({
  title,
  description,
  image,
  large = false,
  type = "website",
}: {
  title: string;
  description?: string;
  image?: string | null;
  large?: boolean;
  type?: "website" | "article" | "book";
}): Pick<Metadata, "description" | "openGraph" | "twitter"> {
  const images = image ? [{ url: image }] : undefined;
  return {
    description,
    openGraph: { title, description, images, type, siteName: "Saint Eresia", locale: "fr_FR" },
    twitter: { card: image && large ? "summary_large_image" : "summary", title, description, images },
  };
}
