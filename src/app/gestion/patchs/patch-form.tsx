"use client";

import { Plus, X } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { MarkdownEditor } from "@/components/markdown-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { PATCH_KINDS, type PatchKind } from "@/lib/patch-kinds";
import { averageProgress, MAX_STEPS, SUGGESTED_STEPS, type ProgressStep } from "@/lib/progress-steps";
import { savePatch, type ActionResult } from "./actions";

type PatchFields = {
  id?: number;
  title: string;
  description: string;
  status: string;
  progress: number;
  downloadUrl: string;
  steamAppId: number | null;
  gogId: number | null;
  steps: ProgressStep[];
  quote: string;
  featured: boolean; // recommandé sur l’accueil
  kind: PatchKind; // rubrique publique : Patchs VN ou Jeux
};

export function PatchForm({ patch, statuses }: { patch: PatchFields; statuses: readonly string[] }) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(savePatch, {});
  const [title, setTitle] = useState(patch.title);
  const [status, setStatus] = useState(patch.status);
  const [progress, setProgress] = useState(patch.progress);
  const [downloadUrl, setDownloadUrl] = useState(patch.downloadUrl);
  const [steamAppId, setSteamAppId] = useState(patch.steamAppId === null ? "" : String(patch.steamAppId));
  const [gogId, setGogId] = useState(patch.gogId === null ? "" : String(patch.gogId));
  const [description, setDescription] = useState(patch.description);
  const [steps, setSteps] = useState(patch.steps);
  const [quote, setQuote] = useState(patch.quote);
  const [featured, setFeatured] = useState(patch.featured ? "1" : "0");
  const [kind, setKind] = useState<PatchKind>(patch.kind);
  const updateStep = (index: number, change: Partial<ProgressStep>) =>
    setSteps((current) => current.map((step, i) => (i === index ? { ...step, ...change } : step)));
  const addStep = (label: string) => setSteps((current) => [...current, { label, value: 0 }]);
  const suggestions = SUGGESTED_STEPS.filter((label) => !steps.some((step) => step.label === label));

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.savedAt) toast.success("Patch enregistré.");
  }, [state]);

  return (
    <form action={formAction} className="space-y-6">
      {patch.id && <input type="hidden" name="id" value={patch.id} />}

      <div className="space-y-2">
        <Label htmlFor="title">Titre</Label>
        <Input id="title" name="title" required maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Rubrique</legend>
        <input type="hidden" name="kind" value={kind} />
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PATCH_KINDS) as PatchKind[]).map((value) => (
            <label
              key={value}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-input px-4 py-2 text-sm font-semibold transition-colors has-checked:border-primary has-checked:bg-primary/10 has-checked:text-primary has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <input
                type="radio"
                name="kind-choice"
                value={value}
                checked={kind === value}
                onChange={() => setKind(value)}
                className="sr-only"
              />
              {PATCH_KINDS[value].plural}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Patchs VN pour les visual novels, Jeux pour les autres jeux vidéo. La fiche publique change d’adresse en conséquence.
        </p>
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status">Statut</Label>
          <input type="hidden" name="status" value={status} />
          <Select value={status} onValueChange={setStatus}>
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
          <Label htmlFor="progress">Avancement global</Label>
          <input type="hidden" name="progress" value={progress} />
          {steps.length > 0 ? (
            <p className="flex h-8 items-center gap-2 text-sm text-muted-foreground">
              <span className="text-lg font-extrabold text-foreground tabular-nums">{averageProgress(steps)} %</span>
              moyenne des catégories
            </p>
          ) : (
            <div className="flex h-8 items-center gap-4">
              <Slider
                id="progress"
                aria-label="Avancement global"
                min={0}
                max={100}
                step={1}
                value={[progress]}
                onValueChange={([value]) => setProgress(value)}
              />
              <span className="w-14 text-right text-lg font-extrabold tabular-nums">{progress} %</span>
            </div>
          )}
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Avancement détaillé</legend>
        <input type="hidden" name="progressSteps" value={JSON.stringify(steps)} />
        {steps.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ajoutez des catégories (traduction, CG, correction…) pour détailler l’avancement sur la fiche du patch.
          </p>
        )}
        {steps.map((step, index) => (
          <div key={index} className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
            <Input
              value={step.label}
              maxLength={60}
              onChange={(e) => updateStep(index, { label: e.target.value })}
              aria-label={`Nom de la catégorie ${index + 1}`}
              className="sm:w-48"
            />
            <Slider
              aria-label={`Avancement : ${step.label || `catégorie ${index + 1}`}`}
              min={0}
              max={100}
              step={1}
              value={[step.value]}
              onValueChange={([value]) => updateStep(index, { value })}
              className="min-w-32 flex-1"
            />
            <span className="w-12 text-right font-bold tabular-nums">{step.value} %</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Retirer ${step.label || "cette catégorie"}`}
              onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}
            >
              <X />
            </Button>
          </div>
        ))}
        {steps.length < MAX_STEPS && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((label) => (
              <Button key={label} type="button" variant="outline" size="sm" className="rounded-full" onClick={() => addStep(label)}>
                <Plus /> {label}
              </Button>
            ))}
            <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => addStep("")}>
              <Plus /> Autre catégorie
            </Button>
          </div>
        )}
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="downloadUrl">Lien de téléchargement</Label>
        <Input
          id="downloadUrl"
          name="downloadUrl"
          type="url"
          placeholder="https://…"
          value={downloadUrl}
          onChange={(e) => setDownloadUrl(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">Laissez vide si le patch n’est pas encore disponible.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="steamAppId">Steam App ID</Label>
          <Input
            id="steamAppId"
            name="steamAppId"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Ex. 970570"
            value={steamAppId}
            onChange={(e) => setSteamAppId(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gogId">ID GOG</Label>
          <Input id="gogId" name="gogId" inputMode="numeric" pattern="[0-9]*" placeholder="Ex. 1207658924" value={gogId} onChange={(e) => setGogId(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Facultatifs : le launcher s’en sert pour retrouver le jeu installé. L’App ID Steam figure dans l’adresse de la page du
          jeu sur le Store (store.steampowered.com/app/<strong>970570</strong>/…).
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <MarkdownEditor
          id="description"
          name="description"
          maxLength={20000}
          value={description}
          onChange={setDescription}
          placeholder="Présentation, prérequis, installation…"
        />
      </div>

      <fieldset className="space-y-4 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-bold">Carrousel « Recommandé » de l’accueil</legend>
        <div className="grid gap-6 sm:grid-cols-[1fr_16rem]">
          <div className="space-y-2">
            <Label htmlFor="quote">Citation</Label>
            <Input id="quote" name="quote" maxLength={120} placeholder="Ex. El Psy Kongroo." value={quote} onChange={(e) => setQuote(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="featured">Affichage</Label>
            <input type="hidden" name="featured" value={featured} />
            <Select value={featured} onValueChange={setFeatured}>
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
          La diapositive montre l’arrière-plan et le logo du patch (section Images), le début de la description, son
          avancement et le bouton de téléchargement.
        </p>
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" size="pill" disabled={pending}>
        {pending ? "Enregistrement…" : patch.id ? "Enregistrer" : "Créer le patch"}
      </Button>
    </form>
  );
}
