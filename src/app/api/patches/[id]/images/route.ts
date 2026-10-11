import { db } from "@/lib/db";
import { handleImageUpload } from "@/lib/upload-handler";
import type { ImageKind } from "@/lib/uploads";

// Envoi d’images d’un patch : une couverture, un arrière-plan, un logo ou plusieurs captures d’écran.
export async function POST(req: Request, ctx: RouteContext<"/api/patches/[id]/images">) {
  const id = Number((await ctx.params).id);
  const patch = await db.prepare("SELECT title FROM patch WHERE id = ?").get<{ title: string }>(id);
  const alts: Partial<Record<ImageKind, string>> = {
    cover: `Couverture de ${patch?.title}`,
    background: `Arrière-plan de ${patch?.title}`,
    logo: `Logo de ${patch?.title}`,
  };
  return handleImageUpload(req, {
    owner: { type: "patch", id },
    label: patch ? patch.title : null,
    kinds: ["cover", "background", "logo", "screenshot"],
    altFor: (kind) => alts[kind] ?? `Capture d’écran de ${patch?.title}`,
  });
}
