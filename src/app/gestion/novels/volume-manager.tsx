"use client";

import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDelete } from "@/components/confirm-delete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addVolume, deleteVolume, updateVolume, type ActionResult } from "./actions";

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
export function VolumeManager({ novelId, volumes }: { novelId: number; volumes: ManagedVolume[] }) {
  const nextNumber = Math.max(0, ...volumes.map((v) => v.number)) + 1;
  return (
    <div className="space-y-5">
      {volumes.length === 0 && <p className="text-muted-foreground">Aucun tome. Ajoutez-en un pour créer des chapitres.</p>}
      {volumes.map((volume) => (
        <VolumeCard key={`${volume.id}-${volume.number}-${volume.title}`} volume={volume} />
      ))}
      <AddVolume key={nextNumber} novelId={novelId} defaultNumber={nextNumber} />
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

function VolumeCard({ volume }: { volume: ManagedVolume }) {
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
          <li key={chapter.id}>
            <Link
              href={`/gestion/chapitres/${chapter.id}`}
              className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/50"
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
        <li>
          <Link
            href={`/gestion/chapitres/nouveau?tome=${volume.id}`}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-muted/50"
          >
            <Plus className="size-4" /> Ajouter un chapitre
          </Link>
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
