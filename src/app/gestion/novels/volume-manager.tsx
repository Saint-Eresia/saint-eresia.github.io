"use client";

import { ChevronRight, FolderInput, ImageUp, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/confirm-delete";
import { uploadImages } from "@/components/dropzone";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { addVolume, deleteVolume, moveChapters, updateVolume, type ActionResult, type VolumeInput } from "./actions";

export type ManagedVolume = {
  id: number;
  number: number;
  label: string;
  title: string;
  note: string;
  image: string; // adresse affichable de l’image du tome, vide sans image
  imageCredit: string;
  reedit: boolean;
  chapters: { id: number; heading: string; published: boolean }[];
};

function report(result: ActionResult, success: string) {
  if (result.error) toast.error(result.error);
  else toast.success(success);
  return !result.error;
}

// Tomes du novel : numéro, intitulé, titre et précision modifiables, liste des chapitres avec leur statut.
// Les chapitres cochés peuvent être déplacés vers un autre tome (barre « Déplacer vers »).
export function VolumeManager({ novelId, volumes }: { novelId: number; volumes: ManagedVolume[] }) {
  const nextNumber = Math.max(0, ...volumes.map((v) => v.number)) + 1;
  const [selected, setSelected] = useState<number[]>([]);
  const toggle = (ids: number[], on: boolean) =>
    setSelected((current) => (on ? [...new Set([...current, ...ids])] : current.filter((id) => !ids.includes(id))));
  // Sélection limitée aux chapitres encore présents (après un déplacement ou une suppression).
  const existing = new Set(volumes.flatMap((volume) => volume.chapters.map((chapter) => chapter.id)));
  const chosen = selected.filter((id) => existing.has(id));

  return (
    <div className="space-y-5">
      {volumes.length === 0 && <p className="text-muted-foreground">Aucun tome. Ajoutez-en un pour créer des chapitres.</p>}
      {volumes.map((volume) => (
        <VolumeCard
          key={`${volume.id}-${volume.number}-${volume.label}-${volume.title}-${volume.note}-${volume.image}-${volume.imageCredit}-${volume.reedit}`}
          novelId={novelId}
          volume={volume}
          selected={chosen}
          onToggle={toggle}
        />
      ))}
      {chosen.length > 0 && (
        <MoveBar novelId={novelId} volumes={volumes} chapterIds={chosen} onDone={() => setSelected([])} />
      )}
      <AddVolume key={nextNumber} novelId={novelId} defaultNumber={nextNumber} />
    </div>
  );
}

// Barre d’action, collée en bas de l’écran tant que des chapitres sont cochés.
function MoveBar({
  novelId,
  volumes,
  chapterIds,
  onDone,
}: {
  novelId: number;
  volumes: ManagedVolume[];
  chapterIds: number[];
  onDone: () => void;
}) {
  const [target, setTarget] = useState("");
  const [pending, startTransition] = useTransition();
  const count = chapterIds.length;
  return (
    <div
      role="region"
      aria-label="Déplacer les chapitres sélectionnés"
      className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-card px-4 py-3 shadow-[0_12px_40px_var(--shadow)]"
    >
      <p className="text-sm font-semibold" aria-live="polite">
        {count} chapitre{count > 1 ? "s" : ""} sélectionné{count > 1 ? "s" : ""}
      </p>
      <label className="flex items-center gap-2 text-sm">
        Déplacer vers
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
        >
          <option value="">Choisir un tome…</option>
          {volumes.map((volume) => (
            <option key={volume.id} value={volume.id}>
              {volume.label || `Tome ${volume.number}`}
              {volume.title && ` : ${volume.title}`}
            </option>
          ))}
        </select>
      </label>
      <Button
        type="button"
        size="sm"
        className="rounded-full"
        disabled={!target || pending}
        onClick={() =>
          startTransition(async () => {
            if (report(await moveChapters(novelId, chapterIds, Number(target)), `${count} chapitre${count > 1 ? "s" : ""} déplacé${count > 1 ? "s" : ""}.`)) {
              setTarget("");
              onDone();
            }
          })
        }
      >
        <FolderInput /> {pending ? "Déplacement…" : "Déplacer"}
      </Button>
      <Button type="button" size="sm" variant="ghost" className="ml-auto rounded-full" onClick={onDone}>
        <X /> Annuler
      </Button>
    </div>
  );
}

// Champs d’un tome, saisis en texte : le numéro est converti à l’envoi.
type VolumeDraft = { number: string; label: string; title: string; note: string; image: string; imageCredit: string; reedit: boolean };
const draftOf = (volume: Pick<ManagedVolume, "number" | "label" | "title" | "note" | "image" | "imageCredit" | "reedit">): VolumeDraft => ({
  number: String(volume.number),
  label: volume.label,
  title: volume.title,
  note: volume.note,
  image: volume.image,
  imageCredit: volume.imageCredit,
  reedit: volume.reedit,
});
const inputOf = (draft: VolumeDraft): VolumeInput => ({ ...draft, number: Number(draft.number) });

function VolumeFields({ novelId, draft, onChange }: { novelId: number; draft: VolumeDraft; onChange: (draft: VolumeDraft) => void }) {
  const set = (key: keyof VolumeDraft) => (e: { target: { value: string } }) => onChange({ ...draft, [key]: e.target.value });
  const [uploading, setUploading] = useState(false);
  return (
    <>
      <label className="flex items-center gap-2 text-sm font-semibold">
        Tome
        <Input type="number" min={0} value={draft.number} onChange={set("number")} className="w-20" aria-label="Numéro du tome" />
      </label>
      <Input
        value={draft.label}
        maxLength={60}
        placeholder={`Intitulé (Tome ${draft.number || "N"})`}
        title="Remplace « Tome N » dans le sommaire, ex. « Arc VI ». Facultatif."
        onChange={set("label")}
        className="w-44"
        aria-label="Intitulé du tome"
      />
      <Input
        value={draft.title}
        maxLength={180}
        placeholder="Titre du tome (facultatif)"
        onChange={set("title")}
        className="min-w-48 flex-1"
        aria-label="Titre du tome"
      />
      <Textarea
        value={draft.note}
        maxLength={2000}
        rows={2}
        placeholder="Précision affichée sous le tome dans le sommaire (facultatif, Markdown), ex. crédits d’une traduction reprise"
        onChange={set("note")}
        className="min-h-0 basis-full"
        aria-label="Précision du tome"
      />
      {/* Image en tête du tome dans le sommaire (bannière ou couverture d’arc) : adresse collée ou fichier envoyé. */}
      <div className="flex basis-full flex-wrap items-center gap-3">
        {draft.image && <img src={draft.image} alt="" className="h-12 w-auto rounded border border-border" />}
        <Input
          value={draft.image}
          placeholder="Image du tome : adresse https://… (facultatif)"
          onChange={set("image")}
          className="min-w-56 flex-1"
          aria-label="Image du tome"
        />
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-semibold transition-colors hover:border-primary hover:text-primary">
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
              const [uploaded] = await uploadImages(`/api/novels/${novelId}/images`, "illustration", files);
              setUploading(false);
              if (uploaded) onChange({ ...draft, image: uploaded.url });
            }}
          />
        </label>
        <Input
          value={draft.imageCredit}
          maxLength={300}
          placeholder="Crédit de l’image (facultatif, Markdown)"
          onChange={set("imageCredit")}
          className="min-w-56 flex-1"
          aria-label="Crédit de l’image du tome"
        />
      </div>
      <label
        className="flex basis-full items-center gap-2 text-sm"
        title="Mention « Re:edit » dans le sommaire : traduction d’une autre équipe, harmonisée par Saint Eresia."
      >
        <input
          type="checkbox"
          checked={draft.reedit}
          onChange={(e) => onChange({ ...draft, reedit: e.target.checked })}
          className="size-4 accent-[var(--primary)]"
        />
        Re:edit : traduit par une autre équipe, seulement harmonisé par Saint Eresia
      </label>
    </>
  );
}

function VolumeCard({
  novelId,
  volume,
  selected,
  onToggle,
}: {
  novelId: number;
  volume: ManagedVolume;
  selected: number[];
  onToggle: (ids: number[], on: boolean) => void;
}) {
  const ids = volume.chapters.map((chapter) => chapter.id);
  const allChecked = ids.length > 0 && ids.every((id) => selected.includes(id));
  const [draft, setDraft] = useState(() => draftOf(volume));
  const [pending, startTransition] = useTransition();
  const saved = draftOf(volume);
  const dirty = (Object.keys(saved) as (keyof VolumeDraft)[]).some((key) => draft[key] !== saved[key]);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <form
        className="flex flex-wrap items-center gap-3 border-b border-border bg-secondary px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            report(await updateVolume(volume.id, inputOf(draft)), "Tome enregistré.");
          });
        }}
      >
        <VolumeFields novelId={novelId} draft={draft} onChange={setDraft} />
        <Button type="submit" size="sm" className="rounded-full" disabled={!dirty || pending}>
          Enregistrer
        </Button>
        <ConfirmDelete
          size="sm"
          label="Supprimer"
          title={`Supprimer le tome ${volume.number} ?`}
          description={
            volume.chapters.length
              ? `Ses ${volume.chapters.length} chapitre(s) seront supprimés définitivement.`
              : "Ce tome ne contient aucun chapitre."
          }
          action={async () => {
            const result = await deleteVolume(volume.id);
            if (!result.error) toast.success("Tome supprimé.");
            return result;
          }}
        />
      </form>
      <ol className="divide-y divide-border">
        {volume.chapters.map((chapter) => (
          <li key={chapter.id} className="flex items-center">
            <input
              type="checkbox"
              checked={selected.includes(chapter.id)}
              onChange={(e) => onToggle([chapter.id], e.target.checked)}
              aria-label={`Sélectionner ${chapter.heading} pour le déplacer`}
              className="ml-4 size-4 shrink-0 cursor-pointer accent-[var(--primary)]"
            />
            <Link
              href={`/gestion/chapitres/${chapter.id}`}
              className="group flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1 truncate font-semibold group-hover:text-primary">{chapter.heading}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold",
                  chapter.published ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                )}
              >
                {chapter.published ? "Publié" : "Brouillon"}
              </span>
              <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary" />
            </Link>
          </li>
        ))}
        <li className="flex flex-wrap items-center justify-between">
          <Link
            href={`/gestion/chapitres/nouveau?tome=${volume.id}`}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-muted/50"
          >
            <Plus className="size-4" /> Ajouter un chapitre
          </Link>
          {ids.length > 1 && (
            <button
              type="button"
              onClick={() => onToggle(ids, !allChecked)}
              className="px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              {allChecked ? "Tout désélectionner" : "Tout sélectionner"}
            </button>
          )}
        </li>
      </ol>
    </div>
  );
}

function AddVolume({ novelId, defaultNumber }: { novelId: number; defaultNumber: number }) {
  const [draft, setDraft] = useState<VolumeDraft>({ number: String(defaultNumber), label: "", title: "", note: "", image: "", imageCredit: "", reedit: false });
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border-strong px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          report(await addVolume(novelId, inputOf(draft)), "Tome ajouté.");
        });
      }}
    >
      <VolumeFields novelId={novelId} draft={draft} onChange={setDraft} />
      <Button type="submit" size="sm" variant="outline" className="rounded-full" disabled={pending}>
        <Plus /> Ajouter le tome
      </Button>
    </form>
  );
}
