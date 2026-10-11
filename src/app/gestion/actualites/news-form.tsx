"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { MarkdownEditor } from "@/components/markdown-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveNews, type ActionResult } from "./actions";

type NewsFields = { id?: number; title: string; content: string; published: boolean };

export function NewsForm({ news }: { news: NewsFields }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(saveNews, {});
  const [title, setTitle] = useState(news.title);
  const [content, setContent] = useState(news.content);
  const [published, setPublished] = useState(news.published ? "1" : "0");

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
