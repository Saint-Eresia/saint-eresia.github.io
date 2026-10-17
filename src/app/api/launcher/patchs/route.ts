import { excerpt } from "@/lib/news";
import { imageUrl, listPatches } from "@/lib/patches";

// Catalogue lu par EresiaLauncher (champs camelCase, voir EresiaLauncher/src/catalogue.rs) :
// un tableau de patchs, images en adresses absolues, description en texte brut.
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const absolute = (url: string) => (url.startsWith("/") ? `${origin}${url}` : url);
  const patches = await listPatches();
  const body = patches.map((patch) => ({
    slug: patch.slug,
    title: patch.title,
    kind: patch.kind,
    status: patch.status,
    progress: patch.progress,
    description: excerpt(patch.description, 2000),
    quote: patch.quote,
    logo: patch.logo ? absolute(imageUrl(patch.logo)) : "",
    background: patch.background ? absolute(imageUrl(patch.background)) : patch.cover ? absolute(imageUrl(patch.cover)) : "",
    cover: patch.cover ? absolute(imageUrl(patch.cover)) : "",
    downloadUrl: patch.downloadUrl,
    pageUrl: `${origin}/${patch.kind === "jeu" ? "jeux" : "patchs"}/${patch.slug}`,
    steamAppId: patch.steamAppId ?? undefined,
    gogId: patch.gogId ?? undefined,
    vndbId: patch.vndbId || undefined,
    updatedAt: patch.updatedAt,
  }));
  return Response.json(body, { headers: { "Cache-Control": "public, max-age=300" } });
}
