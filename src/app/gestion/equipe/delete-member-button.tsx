"use client";

import { ConfirmDelete } from "@/components/confirm-delete";
import { deleteMember } from "./actions";

export function DeleteMemberButton({ memberId, name }: { memberId: number; name: string }) {
  return (
    <ConfirmDelete
      label="Retirer ce membre"
      title={`Retirer ${name} de l’équipe ?`}
      description="Sa fiche et son avatar seront supprimés définitivement."
      action={() => deleteMember(memberId)}
    />
  );
}
