import "server-only";
import { logEntry } from "@/lib/activity";
import { db } from "@/lib/db";
import { fileUrl, IMAGE_KIND_LABELS, MAX_UPLOAD_MB, saveImage, SINGLE_KINDS, type ImageKind, type ImageOwner } from "@/lib/uploads";
import { getViewer } from "@/lib/viewer";

const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const TABLES = {
  patch: { images: "patch_image", owner: "patchId", parent: "patch" },
  novel: { images: "novel_image", owner: "novelId", parent: "novel" },
} as const;

// Traitement commun des envois d’images (glisser-déposer) pour les patchs et les novels.
// Chaque image est ajoutée dans la même transaction que la date de mise à jour et l’entrée du journal d’activité.
export async function handleImageUpload(
  req: Request,
  {
    owner,
    label,
    kinds,
    altFor,
  }: {
    owner: ImageOwner;
    label: string | null; // titre du patch ou du novel ; null s’il n’existe pas
    kinds: ImageKind[];
    altFor: (kind: ImageKind) => string;
  },
) {
  const viewer = await getViewer();
  if (!viewer?.isTeam) return Response.json({ error: "Action réservée aux membres de l’équipe." }, { status: 403 });
  if (label === null) return Response.json({ error: "Contenu introuvable." }, { status: 404 });
  const actor = { id: viewer.id, name: viewer.name };

  const form = await req.formData();
  const kind = form.get("kind") as ImageKind;
  if (!kinds.includes(kind)) return Response.json({ error: "Type d’image invalide." }, { status: 400 });
  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File);
  if (files.length === 0) return Response.json({ error: "Aucun fichier reçu." }, { status: 400 });
  const single = SINGLE_KINDS.includes(kind);
  if (single && files.length > 1) return Response.json({ error: "Envoyez une seule image." }, { status: 400 });

  const { images: imageTable, owner: ownerColumn, parent } = TABLES[owner.type];
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
      const hadOne =
        single && !!(await db.prepare(`SELECT 1 FROM ${imageTable} WHERE ${ownerColumn} = ? AND kind = ?`).get(owner.id, kind));
      const saved = await saveImage(owner, kind, Buffer.from(await file.arrayBuffer()), alt, [
        { sql: `UPDATE ${parent} SET updatedAt = datetime('now') WHERE id = ?`, args: [owner.id] },
        logEntry(actor, {
          type: owner.type,
          id: owner.id,
          label,
          action: "update",
          changes: [
            {
              field: IMAGE_KIND_LABELS[kind],
              before: single ? (hadOne ? "ancienne image" : "(aucune)") : "",
              after: single ? `nouvelle image (${file.name})` : `ajoutée (${file.name})`,
            },
          ],
        }),
      ]);
      images.push({ url: fileUrl(saved.file), alt });
    } catch {
      errors.push(`${file.name} : image illisible.`);
    }
  }
  return Response.json({ saved: images.length, images, errors });
}
