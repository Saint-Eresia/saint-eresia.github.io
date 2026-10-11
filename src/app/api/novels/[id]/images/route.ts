import { db } from "@/lib/db";
import { handleImageUpload } from "@/lib/upload-handler";
import type { ImageKind } from "@/lib/uploads";

// Envoi d’images d’un novel : sa couverture, son arrière-plan, ou des illustrations à insérer dans un chapitre.
export async function POST(req: Request, ctx: RouteContext<"/api/novels/[id]/images">) {
  const id = Number((await ctx.params).id);
  const novel = await db.prepare("SELECT title FROM novel WHERE id = ?").get<{ title: string }>(id);
  const alts: Partial<Record<ImageKind, string>> = {
    cover: `Couverture de ${novel?.title}`,
    background: `Arrière-plan de ${novel?.title}`,
    logo: `Logo de ${novel?.title}`,
  };
  const response = await handleImageUpload(req, {
    owner: { type: "novel", id },
    exists: !!novel,
    kinds: ["cover", "background", "logo", "illustration"],
    altFor: (kind) => alts[kind] ?? "Illustration",
  });
  if (response.ok) await db.prepare("UPDATE novel SET updatedAt = datetime('now') WHERE id = ?").run(id);
  return response;
}
