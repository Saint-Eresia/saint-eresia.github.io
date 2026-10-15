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
  quote: string;
  featured: string; // "1" : recommandé sur l’accueil
  draft: string; // "1" : brouillon, invisible du public
};

const VISIBILITY = [
  { value: "0", label: "Publié", hint: "Visible par tout le monde." },
  { value: "1", label: "Brouillon", hint: "Visible seulement par l’équipe : absent des listes, de l’accueil et de la page Équipe." },
];

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

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Visibilité</legend>
        <input type="hidden" name="draft" value={fields.draft} />
        <div className="flex flex-wrap gap-2">
          {VISIBILITY.map((option) => (
            <label
              key={option.value}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-input px-4 py-2 text-sm font-semibold transition-colors has-checked:border-primary has-checked:bg-primary/10 has-checked:text-primary has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <input
                type="radio"
                name="draft-choice"
                value={option.value}
                checked={fields.draft === option.value}
                onChange={() => set("draft")(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{VISIBILITY.find((option) => option.value === fields.draft)?.hint}</p>
      </fieldset>

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

      <fieldset className="space-y-4 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-bold">Carrousel « Recommandé » de l’accueil</legend>
        <div className="grid gap-6 sm:grid-cols-[1fr_16rem]">
          <div className="space-y-2">
            <Label htmlFor="quote">Citation</Label>
            <Input
              id="quote"
              name="quote"
              maxLength={120}
              placeholder="Ex. Live Alive !"
              value={fields.quote}
              onChange={(e) => set("quote")(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="featured">Affichage</Label>
            <input type="hidden" name="featured" value={fields.featured} />
            <Select value={fields.featured} onValueChange={set("featured")}>
              <SelectTrigger id="featured" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Pas sur l’accueil</SelectItem>
                <SelectItem value="1">Recommandé sur l’accueil</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          La diapositive utilise l’arrière-plan et le logo du novel (section Images), sa présentation et son dernier
          chapitre publié.
        </p>
      </fieldset>

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
