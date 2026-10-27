"use client";

import { Flag } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendTypoReport, type TypoReportState } from "./actions";

// « Signaler une coquille », sous le chapitre. Le texte sélectionné dans le chapitre au moment du clic
// pré-remplit le passage concerné.
export function TypoReport({ novelSlug, chapterSlug }: { novelSlug: string; chapterSlug: string }) {
  const [open, setOpen] = useState(false);
  const [passage, setPassage] = useState("");
  const [state, formAction, pending] = useActionState<TypoReportState, FormData>(sendTypoReport, {});
  const id = useId();

  if (state.sent) {
    return (
      <p role="status" className="text-center text-sm text-muted-foreground">
        Merci, l’équipe a été prévenue.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="text-center">
        <button
          type="button"
          // Au pointerdown, la sélection du lecteur n’a pas encore été effacée par le clic.
          onPointerDown={() => setPassage(window.getSelection()?.toString().trim().slice(0, 1000) ?? "")}
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Flag className="size-3.5" /> Signaler une coquille
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mx-auto max-w-xl space-y-4 rounded-2xl border border-border bg-card p-5">
      <p className="font-semibold">Signaler une coquille</p>
      <input type="hidden" name="novel" value={novelSlug} />
      <input type="hidden" name="chapitre" value={chapterSlug} />
      {/* Piège à robots : invisible et ignoré des lecteurs d’écran. */}
      <input type="text" name="site" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-passage`}>Passage concerné</Label>
        <Textarea
          id={`${id}-passage`}
          name="passage"
          defaultValue={passage}
          maxLength={1000}
          rows={3}
          placeholder="Copiez la phrase, ou sélectionnez-la dans le texte avant d’ouvrir ce formulaire."
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-remarque`}>Coquille ou correction proposée</Label>
        <Textarea id={`${id}-remarque`} name="remarque" required maxLength={1000} rows={3} autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-pseudo`}>Pseudo (facultatif)</Label>
        <Input id={`${id}-pseudo`} name="pseudo" maxLength={60} autoComplete="nickname" />
      </div>
      {state.error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="pill" onClick={() => setOpen(false)}>
          Annuler
        </Button>
        <Button type="submit" size="pill" disabled={pending}>
          {pending ? "Envoi…" : "Envoyer"}
        </Button>
      </div>
    </form>
  );
}
