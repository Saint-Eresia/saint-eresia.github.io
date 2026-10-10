import { db } from "@/lib/db";
import { fileUrl, MAX_UPLOAD_MB, removeFile, saveAvatar } from "@/lib/uploads";
import { getViewer } from "@/lib/viewer";

const MAX_BYTES = Math.min(10, MAX_UPLOAD_MB) * 1024 * 1024;

// Envoi de l’avatar d’un membre de l’équipe ; le nouveau remplace l’ancien.
export async function POST(req: Request, ctx: RouteContext<"/api/team/[id]/avatar">) {
  const viewer = await getViewer();
  if (!viewer?.isTeam) return Response.json({ error: "Action réservée aux membres de l’équipe." }, { status: 403 });

  const id = Number((await ctx.params).id);
  const member = await db.prepare("SELECT name, avatarFile FROM team_member WHERE id = ?").get(id) as
    | { name: string; avatarFile: string }
    | undefined;
  if (!member) return Response.json({ error: "Membre introuvable." }, { status: 404 });

  const file = (await req.formData()).getAll("files").find((entry): entry is File => entry instanceof File);
  if (!file || !file.type.startsWith("image/")) return Response.json({ error: "Envoyez une image." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: `Image trop lourde (${Math.min(10, MAX_UPLOAD_MB)} Mo maximum).` }, { status: 400 });

  try {
    const avatarFile = await saveAvatar(Buffer.from(await file.arrayBuffer()));
    await db.prepare("UPDATE team_member SET avatarFile = ? WHERE id = ?").run(avatarFile, id);
    await removeFile(member.avatarFile);
    return Response.json({ images: [{ url: fileUrl(avatarFile), alt: `Avatar de ${member.name}` }], errors: [] });
  } catch {
    return Response.json({ error: "Image illisible." }, { status: 400 });
  }
}
