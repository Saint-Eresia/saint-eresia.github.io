"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { MarkdownEditor } from "@/components/markdown-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveNovel, type ActionResult } from "./actions";

type NovelFields = {
  id?: number;
  title: string;
  originalTitle: string;
  author: string;
  artist: string;
  status: string;
  synopsis: string;
};

export function NovelForm({ novel, statuses }: { novel: NovelFields; statuses: readonly string[] }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(saveNovel, {});
  const [fields, setFields] = useState(novel);
  const set = (key: keyof NovelFields) => (value: string) => setFields((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.savedAt) toast.success("Novel enregistré.");
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      {novel.id && <input type="hidden" name="id" value={novel.id} />}

      <div className="space-y-2">
        <Label htmlFor="title">Titre</Label>
        <Input id="title" name="title" required maxLength={180} value={fields.title} onChange={(e) => set("title")(e.target.value)} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="originalTitle">Titre original</Label>
          <Input
            id="originalTitle"
            name="originalTitle"
            maxLength={180}
            value={fields.originalTitle}
            onChange={(e) => set("originalTitle")(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">Statut de la traduction</Label>
          <input type="hidden" name="status" value={fields.status} />
          <Select value={fields.status} onValueChange={set("status")}>
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="author">Auteur</Label>
          <Input id="author" name="author" maxLength={120} value={fields.author} onChange={(e) => set("author")(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="artist">Illustrateur</Label>
          <Input id="artist" name="artist" maxLength={120} value={fields.artist} onChange={(e) => set("artist")(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="synopsis">Présentation</Label>
        <MarkdownEditor
          id="synopsis"
          name="synopsis"
          rows={8}
          maxLength={20000}
          value={fields.synopsis}
          onChange={set("synopsis")}
          placeholder="Résumé, notes de traduction, conseils de lecture…"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="pill" disabled={pending}>
        {pending ? "Enregistrement…" : novel.id ? "Enregistrer" : "Créer le novel"}
      </Button>
    </form>
  );
}
