"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Dropzone } from "@/components/dropzone";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { deleteImage, reorderScreenshots, updateImageAlt, type ActionResult } from "./actions";

export type ManagedImage = { id: number; src: string; alt: string; width: number; height: number };

function report(result: ActionResult, success: string) {
  if (result.error) toast.error(result.error);
  else toast.success(success);
  return !result.error;
}

export function ImageManager({
  patchId,
  cover,
  background,
  logo,
  screenshots,
}: {
  patchId: number;
  cover: ManagedImage | null;
  background: ManagedImage | null;
  logo: ManagedImage | null;
  screenshots: ManagedImage[];
}) {
  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h3 className="text-lg font-extrabold">Couverture</h3>
        {cover && (
          <div className="flex gap-4">
            <img src={cover.src} alt={cover.alt} className="aspect-[3/4] w-28 shrink-0 rounded-lg border border-border object-cover" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <AltInput image={cover} />
              <DeleteImageButton image={cover} className="self-start" />
            </div>
          </div>
        )}
        <Dropzone endpoint={`/api/patches/${patchId}/images`} kind="cover" label={cover ? "Remplacer la couverture" : "Ajouter une couverture"} />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-extrabold">Arrière-plan</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Image large affichée derrière le titre de la fiche (une capture ou un artwork en paysage). Sans arrière-plan,
            la couverture floutée est utilisée.
          </p>
        </div>
        {background && (
          <div className="space-y-2">
            <img
              src={background.src}
              alt={background.alt}
              className="aspect-[16/6] w-full rounded-lg border border-border object-cover"
            />
            <DeleteImageButton image={background} />
          </div>
        )}
        <Dropzone
          endpoint={`/api/patches/${patchId}/images`}
          kind="background"
          label={background ? "Remplacer l’arrière-plan" : "Ajouter un arrière-plan"}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-lg font-extrabold">Logo</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Affiché à droite dans le carrousel « Recommandé » de l’accueil. Utilisez un PNG à fond transparent (logo du
            jeu ou personnage détouré).
          </p>
        </div>
        {logo && (
          <div className="space-y-2">
            {/* Damier : la transparence du logo reste visible. */}
            <div className="grid h-40 place-items-center rounded-lg border border-border bg-[repeating-conic-gradient(var(--muted)_0_25%,transparent_0_50%)] bg-[length:20px_20px] p-3">
              <img src={logo.src} alt={logo.alt} className="max-h-full max-w-full object-contain" />
            </div>
            <DeleteImageButton image={logo} />
          </div>
        )}
        <Dropzone endpoint={`/api/patches/${patchId}/images`} kind="logo" label={logo ? "Remplacer le logo" : "Ajouter un logo"} />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-extrabold">Captures d’écran</h3>
        {/* La clé force une remise à zéro quand la liste change côté serveur (ajout, suppression). */}
        <SortableScreenshots key={screenshots.map((s) => s.id).join("-")} patchId={patchId} initial={screenshots} />
        <Dropzone endpoint={`/api/patches/${patchId}/images`} kind="screenshot" multiple label="Ajouter des captures d’écran" />
      </section>
    </div>
  );
}

function SortableScreenshots({ patchId, initial }: { patchId: number; initial: ManagedImage[] }) {
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (items.length === 0) return <p className="text-sm text-muted-foreground">Aucune capture pour l’instant.</p>;

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const previous = items;
    const next = arrayMove(items, items.findIndex((i) => i.id === active.id), items.findIndex((i) => i.id === over.id));
    setItems(next);
    startTransition(async () => {
      const result = await reorderScreenshots(patchId, next.map((i) => i.id));
      if (!report(result, "Ordre enregistré.")) setItems(previous);
    });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: {
          draggable: "Appuyez sur Espace pour saisir l’image, utilisez les flèches pour la déplacer, puis Espace pour la déposer.",
        },
        announcements: {
          onDragStart: ({ active }) => `Image ${items.findIndex((i) => i.id === active.id) + 1} saisie.`,
          onDragOver: ({ over }) => (over ? `Position ${items.findIndex((i) => i.id === over.id) + 1}.` : ""),
          onDragEnd: ({ over }) => (over ? `Image déposée en position ${items.findIndex((i) => i.id === over.id) + 1}.` : ""),
          onDragCancel: () => "Déplacement annulé.",
        },
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((image, index) => (
            <SortableShot key={image.id} image={image} index={index} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

function SortableShot({ image, index }: { image: ManagedImage; index: number }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("space-y-2 rounded-xl border border-border bg-background/60 p-2", isDragging && "z-10 border-primary shadow-[0_18px_40px_var(--shadow)]")}
    >
      <div className="relative">
        <img src={image.src} alt={image.alt} className="aspect-video w-full rounded-lg object-cover" />
        <span className="absolute top-1.5 left-1.5 rounded-full bg-overlay/70 px-2 text-xs font-bold text-on-overlay/85 tabular-nums">
          {index + 1}
        </span>
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Déplacer la capture ${index + 1}`}
          className="absolute top-1.5 right-1.5 grid size-8 cursor-grab place-items-center rounded-full bg-overlay/70 text-on-overlay/85 hover:bg-overlay hover:text-on-overlay focus-visible:ring-3 focus-visible:ring-ring/60 focus-visible:outline-none active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      </div>
      <AltInput image={image} />
      <DeleteImageButton image={image} />
    </li>
  );
}

function AltInput({ image }: { image: ManagedImage }) {
  const [value, setValue] = useState(image.alt);
  const [saved, setSaved] = useState(image.alt);
  const [pending, startTransition] = useTransition();

  function save() {
    if (value.trim() === saved) return;
    startTransition(async () => {
      if (report(await updateImageAlt(image.id, value), "Texte alternatif enregistré.")) setSaved(value.trim());
    });
  }

  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-muted-foreground">Texte alternatif {pending && "· enregistrement…"}</span>
      <Input
        value={value}
        maxLength={300}
        placeholder="Décrivez l’image"
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            save();
          }
        }}
      />
    </label>
  );
}

function DeleteImageButton({ image, className }: { image: ManagedImage; className?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50",
        className,
      )}
      onClick={() => {
        if (!confirm("Supprimer cette image ? Cette action est définitive.")) return;
        startTransition(async () => {
          report(await deleteImage(image.id), "Image supprimée.");
        });
      }}
    >
      <Trash2 className="size-3.5" /> {pending ? "Suppression…" : "Supprimer"}
    </button>
  );
}
