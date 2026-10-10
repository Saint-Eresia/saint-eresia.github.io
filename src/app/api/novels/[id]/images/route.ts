import { db } from "@/lib/db";
import { handleImageUpload } from "@/lib/upload-handler";

// Envoi d’images d’un novel : sa couverture, ou des illustrations à insérer dans un chapitre.
export async function POST(req: Request, ctx: RouteContext<"/api/novels/[id]/images">) {
  const id = Number((await ctx.params).id);
  const novel = await db.prepare("SELECT title FROM novel WHERE id = ?").get(id) as { title: string } | undefined;
  const response = await handleImageUpload(req, {
    owner: { type: "novel", id },
    exists: !!novel,
    kinds: ["cover", "illustration"],
    altFor: (kind) => (kind === "cover" ? `Couverture de ${novel?.title}` : "Illustration"),
  });
  if (response.ok) await db.prepare("UPDATE novel SET updatedAt = datetime('now') WHERE id = ?").run(id);
  return response;
}
