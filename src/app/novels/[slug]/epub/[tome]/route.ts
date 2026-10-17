import { BlobNotFoundError, head, put } from "@vercel/blob";
import { db } from "@/lib/db";
import { buildEpub, epubFileName, epubKey, type EpubInput } from "@/lib/epub";
import { canSeeNovel, getNovelBySlug, type Chapter } from "@/lib/novels";

// Le premier téléchargement d’un tome génère l’EPUB (illustrations comprises) : il peut prendre du temps.
export const maxDuration = 60;

// EPUB d’un tome (numéro du tome dans l’adresse). Sur Vercel, le fichier est mis en cache sur Vercel Blob
// sous une empreinte du contenu, puis la réponse redirige vers lui : une réponse de fonction est limitée à
// 4,5 Mo, et un tome illustré les dépasse. Un tome modifié change d’empreinte et donc de fichier.
export async function GET(request: Request, ctx: RouteContext<"/novels/[slug]/epub/[tome]">) {
  const { slug, tome } = await ctx.params;
  const novel = await getNovelBySlug(slug);
  if (!novel || !(await canSeeNovel(novel))) return new Response("Light novel introuvable", { status: 404 });
  const volume = novel.volumes.find((v) => String(v.number) === tome);
  if (!volume) return new Response("Tome introuvable", { status: 404 });
  const chapters = await db
    .prepare("SELECT * FROM chapter WHERE volumeId = ? AND published = 1 ORDER BY position, id")
    .all<Chapter>(volume.id);
  if (chapters.length === 0) return new Response("Tome vide", { status: 404 });

  const input: EpubInput = { novel, cover: novel.cover, volume, chapters, siteUrl: new URL(request.url).origin };
  const name = epubFileName(input);
  const pathname = `epub/${epubKey(input)}/${name}`;

  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    try {
      const cached = await head(pathname);
      return Response.redirect(cached.downloadUrl, 302);
    } catch (error) {
      if (!(error instanceof BlobNotFoundError)) throw error;
    }
    const blob = await put(pathname, await buildEpub(input), {
      access: "public",
      contentType: "application/epub+zip",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 31_536_000,
    });
    return Response.redirect(blob.downloadUrl, 302);
  }

  // En local, sans Vercel Blob : fichier envoyé directement.
  return new Response(new Uint8Array(await buildEpub(input)), {
    headers: {
      "Content-Type": "application/epub+zip",
      "Content-Disposition": `attachment; filename="tome-${volume.number}.epub"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });
}
