"use client";

import { ImageUp, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { uploadImages } from "@/components/dropzone";
import { MarkdownEditor } from "@/components/markdown-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveNews, type ActionResult } from "./actions";

type NewsFields = { id?: number; title: string; content: string; thumbnail: string; published: boolean };

export function NewsForm({ news }: { news: NewsFields }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(saveNews, {});
  const [title, setTitle] = useState(news.title);
  const [content, setContent] = useState(news.content);
  const [published, setPublished] = useState(news.published ? "1" : "0");
  const [thumbnail, setThumbnail] = useState(news.thumbnail);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.savedAt) toast.success("Actualité enregistrée.");
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      {news.id && <input type="hidden" name="id" value={news.id} />}

      <div className="grid gap-6 sm:grid-cols-[1fr_16rem]">
        <div className="space-y-2">
          <Label htmlFor="title">Titre</Label>
          <Input id="title" name="title" required maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="published">Statut</Label>
          <input type="hidden" name="published" value={published} />
          <Select value={published} onValueChange={setPublished}>
            <SelectTrigger id="published" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Brouillon (invisible du public)</SelectItem>
              <SelectItem value="1">Publiée</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Miniature facultative : adresse collée ou fichier envoyé (converti en WebP dès l’envoi). */}
      <div className="space-y-2">
        <Label htmlFor="thumbnail">Miniature (facultative)</Label>
        <div className="flex flex-wrap items-center gap-3">
          {thumbnail && <img src={thumbnail} alt="" className="h-16 w-auto max-w-32 rounded-lg border border-border object-cover" />}
          <Input
            id="thumbnail"
            name="thumbnail"
            value={thumbnail}
            maxLength={500}
            placeholder="Adresse https://… ou image envoyée"
            onChange={(e) => setThumbnail(e.target.value)}
            className="min-w-56 flex-1"
          />
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary has-disabled:cursor-wait">
            <ImageUp className="size-4" /> {uploading ? "Envoi…" : "Envoyer"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={uploading}
              onChange={async (e) => {
                const files = [...(e.target.files ?? [])];
                e.target.value = "";
                if (!files.length) return;
                setUploading(true);
                const [uploaded] = await uploadImages("/api/news/thumbnail", "thumbnail", files.slice(0, 1));
                setUploading(false);
                if (uploaded) setThumbnail(uploaded.url);
              }}
            />
          </label>
          {thumbnail && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setThumbnail("")}>
              <X /> Retirer
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">Affichée dans la liste des actualités, sur l’accueil et dans les aperçus de partage.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Texte</Label>
        <MarkdownEditor
          id="content"
          name="content"
          rows={14}
          maxLength={50000}
          value={content}
          onChange={setContent}
          placeholder="Sortie d’un patch, nouveau chapitre, recrutement… Le début du texte sert d’aperçu sur l’accueil."
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="pill" disabled={pending}>
        {pending ? "Enregistrement…" : news.id ? "Enregistrer" : "Créer l’actualité"}
      </Button>
    </form>
  );
}
