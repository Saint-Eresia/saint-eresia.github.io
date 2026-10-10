import "server-only";
import { fileUrl, MAX_UPLOAD_MB, saveImage, type ImageKind, type ImageOwner } from "@/lib/uploads";
import { getViewer } from "@/lib/viewer";

const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

// Traitement commun des envois d’images (glisser-déposer) pour les patchs et les novels.
export async function handleImageUpload(
  req: Request,
  {
    owner,
    exists,
    kinds,
    altFor,
  }: {
    owner: ImageOwner;
    exists: boolean;
    kinds: ImageKind[];
    altFor: (kind: ImageKind) => string;
  },
) {
  const viewer = await getViewer();
  if (!viewer?.isTeam) return Response.json({ error: "Action réservée aux membres de l’équipe." }, { status: 403 });
  if (!exists) return Response.json({ error: "Contenu introuvable." }, { status: 404 });

  const form = await req.formData();
  const kind = form.get("kind") as ImageKind;
  if (!kinds.includes(kind)) return Response.json({ error: "Type d’image invalide." }, { status: 400 });
  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (files.length === 0) return Response.json({ error: "Aucun fichier reçu." }, { status: 400 });
  if (kind === "cover" && files.length > 1) return Response.json({ error: "Une seule image de couverture." }, { status: 400 });

  const errors: string[] = [];
  const images: { url: string; alt: string }[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      errors.push(`${file.name} : ce n’est pas une image.`);
      continue;
    }
    if (file.size > MAX_BYTES) {
      errors.push(`${file.name} : fichier trop lourd (${MAX_UPLOAD_MB} Mo maximum).`);
      continue;
    }
    try {
      const alt = altFor(kind);
      const saved = await saveImage(owner, kind, Buffer.from(await file.arrayBuffer()), alt);
      images.push({ url: fileUrl(saved.file), alt });
    } catch {
      errors.push(`${file.name} : image illisible.`);
    }
  }
  return Response.json({ saved: images.length, images, errors });
}
