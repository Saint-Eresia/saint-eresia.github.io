import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

// Indexation : tout le site public, sauf l’espace de gestion, la connexion et l’API.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/gestion", "/connexion", "/api/"] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
