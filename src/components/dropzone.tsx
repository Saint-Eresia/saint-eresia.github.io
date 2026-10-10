"use client";

import { ImageUp, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type UploadedImage = { url: string; alt: string };

// Envoie des images à une route /api/…/images ; elles y sont converties en WebP.
export async function uploadImages(endpoint: string, kind: string, files: File[]) {
  const images = files.filter((file) => file.type.startsWith("image/"));
  if (images.length === 0) {
    toast.error("Déposez des fichiers image (JPEG, PNG, WebP…).");
    return [];
  }
  const body = new FormData();
  body.set("kind", kind);
  for (const file of images) body.append("files", file);
  try {
    const res = await fetch(endpoint, { method: "POST", body });
    const data = (await res.json()) as { images?: UploadedImage[]; errors?: string[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Envoi impossible.");
    data.errors?.forEach((message) => toast.error(message));
    const count = data.images?.length ?? 0;
    if (count) toast.success(count > 1 ? `${count} images ajoutées.` : "Image ajoutée.");
    return data.images ?? [];
  } catch (error) {
    toast.error((error as Error).message);
    return [];
  }
}

export function Dropzone({
  endpoint,
  kind,
  multiple,
  label,
  onUploaded,
}: {
  endpoint: string;
  kind: string;
  multiple?: boolean;
  label: string;
  /** Par défaut, la page est rechargée pour afficher les nouvelles images. */
  onUploaded?: (images: UploadedImage[]) => void;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function upload(files: File[]) {
    setUploading(true);
    const images = await uploadImages(endpoint, kind, multiple ? files : files.slice(0, 1));
    setUploading(false);
    if (input.current) input.current.value = "";
    if (images.length === 0) return;
    if (onUploaded) onUploaded(images);
    else router.refresh();
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!uploading) upload(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border-strong px-4 py-8 text-center transition-colors",
        over && "border-primary bg-accent/50",
      )}
    >
      {uploading ? (
        <Loader2 className="size-7 animate-spin text-primary" />
      ) : (
        <ImageUp className={cn("size-7 text-muted-foreground", over && "text-primary")} />
      )}
      <p className="font-semibold">{uploading ? "Conversion en WebP…" : label}</p>
      <p className="text-sm text-muted-foreground">
        Glissez-déposez {multiple ? "vos images" : "une image"} ici, ou{" "}
        <button
          type="button"
          className="font-semibold text-primary underline underline-offset-2"
          onClick={() => input.current?.click()}
          disabled={uploading}
        >
          parcourez vos fichiers
        </button>
      </p>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => upload(Array.from(e.target.files ?? []))}
      />
    </div>
  );
}
