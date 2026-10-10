import fs from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/db";
import { FILE_PATTERN } from "@/lib/uploads";

// Images stockées en local (développement). Sur Vercel Blob, les images ont leur propre adresse.
export async function GET(_req: Request, ctx: RouteContext<"/uploads/[file]">) {
  const { file } = await ctx.params;
  if (!FILE_PATTERN.test(file)) return new Response("Introuvable", { status: 404 });
  try {
    const data = await fs.readFile(path.join(UPLOAD_DIR, file));
    return new Response(data, {
      headers: {
        "Content-Type": "image/webp",
        // Chaque envoi reçoit un nouveau nom : le fichier ne change jamais.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
}
