"use client";

import { ConfirmDelete } from "@/components/confirm-delete";
import { deleteNews } from "./actions";

export function DeleteNewsButton({ newsId, title }: { newsId: number; title: string }) {
  return (
    <ConfirmDelete
      label="Supprimer cette actualité"
      title={`Supprimer « ${title} » ?`}
      description="L’actualité sera supprimée définitivement."
      action={() => deleteNews(newsId)}
    />
  );
}
