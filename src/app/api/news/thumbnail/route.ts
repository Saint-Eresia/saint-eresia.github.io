import { fileUrl, MAX_UPLOAD_MB, saveThumbnail } from "@/lib/uploads";
import { getViewer } from "@/lib/viewer";

const MAX_BYTES = Math.min(10, MAX_UPLOAD_MB) * 1024 * 1024;

// Envoi de la miniature d’une actualité, avant même sa création : l’image est seulement convertie et stockée,
// le formulaire garde son adresse et l’enregistre avec l’actualité.
export async function POST(req: Request) {
  const viewer = await getViewer();
  if (!viewer?.isTeam) return Response.json({ error: "Action réservée aux membres de l’équipe." }, { status: 403 });

  const file = (await req.formData()).getAll("files").find((entry): entry is File => entry instanceof File);
  if (!file || !file.type.startsWith("image/")) return Response.json({ error: "Envoyez une image." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: `Image trop lourde (${Math.min(10, MAX_UPLOAD_MB)} Mo maximum).` }, { status: 400 });

  try {
    const thumbnail = await saveThumbnail(Buffer.from(await file.arrayBuffer()));
    return Response.json({ images: [{ url: fileUrl(thumbnail), alt: "" }], errors: [] });
  } catch {
    return Response.json({ error: "Image illisible." }, { status: 400 });
  }
}
