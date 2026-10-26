import { del, list, put } from "@vercel/blob";
import { backupArchive, backupFileName } from "@/lib/backup";
import { getViewer } from "@/lib/viewer";

export const maxDuration = 60;

// Nombre de sauvegardes gardées sur Vercel Blob ; les plus anciennes sont supprimées.
const KEEP = 10;

// Bouton « Sauvegarder la base » de la gestion : télécharge une archive de toute la base (voir lib/backup.ts).
// Sur Vercel, une réponse de fonction est limitée à 4,5 Mo : l'archive est déposée sur Vercel Blob sous une
// adresse impossible à deviner, puis la réponse redirige vers elle (comme les EPUB).
export async function GET() {
  const viewer = await getViewer();
  if (!viewer?.isTeam) return new Response("Réservé aux membres de l’équipe.", { status: 403 });
  const { data } = await backupArchive();
  const name = backupFileName();

  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
    const blob = await put(`sauvegardes/${name}`, data, { access: "public", contentType: "application/zip", addRandomSuffix: true });
    const { blobs } = await list({ prefix: "sauvegardes/" });
    const old = blobs.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()).slice(KEEP);
    if (old.length) await del(old.map((b) => b.url));
    return Response.redirect(blob.downloadUrl, 302);
  }

  // En local, sans Vercel Blob : fichier envoyé directement.
  return new Response(new Uint8Array(data), {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" },
  });
}
