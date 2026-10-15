"use client";

import { ChevronRight, FolderInput, Plus, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addVolume, deleteVolume, moveChapters, updateVolume, type ActionResult } from "./actions";

export type ManagedVolume = {
  id: number;
  number: number;
  title: string;
  chapters: { id: number; heading: string; published: boolean }[];
};

function report(result: ActionResult, success: string) {
  if (result.error) toast.error(result.error);
  else toast.success(success);
  return !result.error;
}

// Tomes du novel : numéro et titre modifiables, liste des chapitres avec leur statut.
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
        <VolumeCard key={`${volume.id}-${volume.number}-${volume.title}`} volume={volume} selected={chosen} onToggle={toggle} />
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
              Tome {volume.number}
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

function VolumeFields({
  number,
  title,
  onNumber,
  onTitle,
}: {
  number: string;
  title: string;
  onNumber: (value: string) => void;
  onTitle: (value: string) => void;
}) {
  return (
    <>
      <label className="flex items-center gap-2 text-sm font-semibold">
        Tome
        <Input
          type="number"
          min={0}
          value={number}
          onChange={(e) => onNumber(e.target.value)}
          className="w-20"
          aria-label="Numéro du tome"
        />
      </label>
      <Input
        value={title}
        maxLength={180}
        placeholder="Titre du tome (facultatif)"
        onChange={(e) => onTitle(e.target.value)}
        className="min-w-48 flex-1"
        aria-label="Titre du tome"
      />
    </>
  );
}

function VolumeCard({
  volume,
  selected,
  onToggle,
}: {
  volume: ManagedVolume;
  selected: number[];
  onToggle: (ids: number[], on: boolean) => void;
}) {
  const ids = volume.chapters.map((chapter) => chapter.id);
  const allChecked = ids.length > 0 && ids.every((id) => selected.includes(id));
  const [number, setNumber] = useState(String(volume.number));
  const [title, setTitle] = useState(volume.title);
  const [pending, startTransition] = useTransition();
  const dirty = number !== String(volume.number) || title !== volume.title;

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <form
        className="flex flex-wrap items-center gap-3 border-b border-border bg-secondary px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            report(await updateVolume(volume.id, Number(number), title), "Tome enregistré.");
          });
        }}
      >
        <VolumeFields number={number} title={title} onNumber={setNumber} onTitle={setTitle} />
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
  const [number, setNumber] = useState(String(defaultNumber));
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border-strong px-4 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          report(await addVolume(novelId, Number(number), title), "Tome ajouté.");
        });
      }}
    >
      <VolumeFields number={number} title={title} onNumber={setNumber} onTitle={setTitle} />
      <Button type="submit" size="sm" variant="outline" className="rounded-full" disabled={pending}>
        <Plus /> Ajouter le tome
      </Button>
    </form>
  );
}
