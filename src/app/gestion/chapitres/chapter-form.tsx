"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { MarkdownEditor } from "@/components/markdown-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveChapter, type ActionResult } from "../novels/actions";

type ChapterFields = {
  id?: number;
  volumeId: number;
  label: string;
  title: string;
  position: number;
  published: boolean;
  translators: string;
  credits: string;
  downloadUrl: string;
  phase: string;
  // AAAA-MM-JJ, vide : date de la première publication, fixée automatiquement.
  releaseDate?: string;
  content: string;
};

export function ChapterForm({
  chapter,
  novelId,
  volumes,
  phases,
}: {
  chapter: ChapterFields;
  novelId: number;
  volumes: { id: number; heading: string }[];
  phases: string[]; // phases déjà employées dans le novel, proposées à la saisie
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(saveChapter, {});
  const [volumeId, setVolumeId] = useState(String(chapter.volumeId));
  const [label, setLabel] = useState(chapter.label);
  const [title, setTitle] = useState(chapter.title);
  const [position, setPosition] = useState(String(chapter.position));
  const [published, setPublished] = useState(chapter.published ? "1" : "0");
  const [phase, setPhase] = useState(chapter.phase);
  const [translators, setTranslators] = useState(chapter.translators);
  const [credits, setCredits] = useState(chapter.credits);
  const [downloadUrl, setDownloadUrl] = useState(chapter.downloadUrl);
  const [releaseDate, setReleaseDate] = useState(chapter.releaseDate ?? "");
  const [content, setContent] = useState(chapter.content);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.savedAt) toast.success("Chapitre enregistré.");
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      {chapter.id && <input type="hidden" name="id" value={chapter.id} />}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2 lg:col-span-2">
          <Label htmlFor="volumeId">Tome</Label>
          <input type="hidden" name="volumeId" value={volumeId} />
          <Select value={volumeId} onValueChange={setVolumeId}>
            <SelectTrigger id="volumeId" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {volumes.map((volume) => (
                <SelectItem key={volume.id} value={String(volume.id)}>
                  {volume.heading}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="position">Ordre dans le tome</Label>
          <Input id="position" name="position" type="number" min={0} required value={position} onChange={(e) => setPosition(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="published">Statut</Label>
          <input type="hidden" name="published" value={published} />
          <Select value={published} onValueChange={setPublished}>
            <SelectTrigger id="published" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Brouillon (invisible des lecteurs)</SelectItem>
              <SelectItem value="1">Publié</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="label">Libellé</Label>
          <Input
            id="label"
            name="label"
            required
            maxLength={80}
            placeholder="Chapitre 3, Prologue, Tome 1…"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="title">Titre (facultatif)</Label>
          <Input id="title" name="title" maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phase">Phase (facultatif)</Label>
          <Input
            id="phase"
            name="phase"
            maxLength={80}
            list="phases"
            placeholder="Phase 1, Partie 2…"
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
          />
          <datalist id="phases">
            {phases.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">Les chapitres consécutifs de même phase sont regroupés sous ce sous-titre dans le sommaire.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="translators">Traduction</Label>
          <Input
            id="translators"
            name="translators"
            maxLength={200}
            placeholder="Noms des traducteurs, équipe…"
            value={translators}
            onChange={(e) => setTranslators(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Affiché sous le titre du chapitre et, s’il change d’un chapitre à l’autre, dans le sommaire.</p>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="credits">Crédits détaillés (facultatif)</Label>
          <Textarea
            id="credits"
            name="credits"
            rows={2}
            maxLength={1000}
            placeholder={"Ex. Traduction française : X (de l’anglais), relecture Y — [Équipe](https://…)\nVersion anglaise : Z"}
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Affichés sous le titre du chapitre seulement (pas dans le sommaire), à la place du champ Traduction. Une ligne par
            crédit ; liens au format [texte](https://…).
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="downloadUrl">Lien de téléchargement (facultatif)</Label>
          <Input
            id="downloadUrl"
            name="downloadUrl"
            type="url"
            placeholder="https://… (PDF, EPUB)"
            value={downloadUrl}
            onChange={(e) => setDownloadUrl(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="releaseDate">Date de sortie</Label>
          <Input id="releaseDate" name="releaseDate" type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Affichée dans le sommaire et le flux RSS. Vide : date de la première publication, fixée automatiquement.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Texte</Label>
        <MarkdownEditor
          id="content"
          name="content"
          rows={28}
          reader
          value={content}
          onChange={setContent}
          uploadEndpoint={`/api/novels/${novelId}/images`}
          placeholder="Le texte du chapitre. Une ligne vide sépare deux paragraphes."
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="pill" disabled={pending}>
        {pending ? "Enregistrement…" : chapter.id ? "Enregistrer" : "Créer le chapitre"}
      </Button>
    </form>
  );
}
