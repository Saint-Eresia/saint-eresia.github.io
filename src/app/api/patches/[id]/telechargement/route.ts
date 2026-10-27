import { db } from "@/lib/db";
import { isBot, recordDownload } from "@/lib/stats";

// Clic sur « Télécharger » d’une fiche patch (envoyé par navigator.sendBeacon, voir gllia-button.tsx) :
// compté une fois par jour et par téléchargeur, pour « Ce patch a déjà été téléchargé X fois ».
export async function POST(request: Request, ctx: RouteContext<"/api/patches/[id]/telechargement">) {
  const id = Number((await ctx.params).id);
  const patch = await db
    .prepare("SELECT id FROM patch WHERE id = ? AND draft = 0 AND downloadUrl != ''")
    .get<{ id: number }>(Number.isInteger(id) ? id : 0);
  if (!patch) return new Response(null, { status: 404 });
  if (!isBot(request.headers.get("user-agent"))) await recordDownload(Number(patch.id), request);
  return new Response(null, { status: 204 });
}
