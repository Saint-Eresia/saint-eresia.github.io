import { db } from "@/lib/db";
import { handleImageUpload } from "@/lib/upload-handler";

// Envoi d’images d’un patch : une couverture ou plusieurs captures d’écran.
export async function POST(req: Request, ctx: RouteContext<"/api/patches/[id]/images">) {
  const id = Number((await ctx.params).id);
  const patch = db.prepare("SELECT title FROM patch WHERE id = ?").get(id) as { title: string } | undefined;
  const response = await handleImageUpload(req, {
    owner: { type: "patch", id },
    exists: !!patch,
    kinds: ["cover", "screenshot"],
    altFor: (kind) => (kind === "cover" ? `Couverture de ${patch?.title}` : `Capture d’écran de ${patch?.title}`),
  });
  if (response.ok) db.prepare("UPDATE patch SET updatedAt = datetime('now') WHERE id = ?").run(id);
  return response;
}
