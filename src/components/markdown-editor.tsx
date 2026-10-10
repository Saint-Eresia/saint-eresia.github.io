"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { uploadImages } from "@/components/dropzone";
import { Markdown } from "@/components/markdown";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Zone de saisie Markdown avec aperçu. Avec `uploadEndpoint`, une image glissée dans le texte
// (ou choisie via le bouton) est convertie en WebP puis insérée à l’emplacement du curseur.
export function MarkdownEditor({
  id,
  name,
  value,
  onChange,
  rows = 16,
  maxLength,
  placeholder,
  reader = false,
  uploadEndpoint,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  reader?: boolean;
  uploadEndpoint?: string;
}) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [over, setOver] = useState(false);

  async function insertImages(files: File[]) {
    if (!uploadEndpoint || uploading) return;
    // Position du curseur au moment du dépôt, avant que l’envoi ne prenne du temps.
    const at = textarea.current?.selectionStart ?? value.length;
    setUploading(true);
    const images = await uploadImages(uploadEndpoint, "illustration", files);
    setUploading(false);
    if (images.length === 0) return;
    const snippet = `\n\n${images.map((image) => `![${image.alt}](${image.url})`).join("\n\n")}\n\n`;
    onChange(value.slice(0, at) + snippet + value.slice(at));
  }

  return (
    <Tabs defaultValue="ecrire">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="ecrire">Écrire</TabsTrigger>
          <TabsTrigger value="apercu">Aperçu</TabsTrigger>
        </TabsList>
        {uploadEndpoint && (
          <>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
            >
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              {uploading ? "Conversion en WebP…" : "Insérer une illustration"}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                insertImages(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </>
        )}
      </div>
      <TabsContent value="ecrire" forceMount className="data-[state=inactive]:hidden">
        <Textarea
          ref={textarea}
          id={id}
          name={name}
          rows={rows}
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn("field-sizing-fixed font-mono text-sm leading-relaxed", over && "border-primary ring-3 ring-primary/30")}
          onDragOver={(e) => {
            if (!uploadEndpoint || !e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            if (!uploadEndpoint || e.dataTransfer.files.length === 0) return;
            e.preventDefault();
            setOver(false);
            insertImages(Array.from(e.dataTransfer.files));
          }}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Markdown : **gras**, *italique*, ## Titre, - liste, 1. étapes, &gt; citation, --- séparation, [lien](https://…)
          {uploadEndpoint && " · glissez une image dans le texte pour l’insérer"}
        </p>
      </TabsContent>
      <TabsContent value="apercu">
        <div className="min-h-40 rounded-lg border border-input p-5">
          {value.trim() ? <Markdown reader={reader}>{value}</Markdown> : <p className="text-muted-foreground">Rien à afficher.</p>}
        </div>
      </TabsContent>
    </Tabs>
  );
}
