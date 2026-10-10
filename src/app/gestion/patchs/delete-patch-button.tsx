"use client";

import { ConfirmDelete } from "@/components/confirm-delete";
import { deletePatch } from "./actions";

export function DeletePatchButton({ patchId, title }: { patchId: number; title: string }) {
  return (
    <ConfirmDelete
      label="Supprimer ce patch"
      title={`Supprimer « ${title} » ?`}
      description="La fiche, sa description et toutes ses images seront supprimées définitivement."
      action={() => deletePatch(patchId)}
    />
  );
}
