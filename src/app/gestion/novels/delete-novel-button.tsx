"use client";

import { ConfirmDelete } from "@/components/confirm-delete";
import { deleteChapter, deleteNovel } from "./actions";

export function DeleteNovelButton({ novelId, title }: { novelId: number; title: string }) {
  return (
    <ConfirmDelete
      label="Supprimer ce novel"
      title={`Supprimer « ${title} » ?`}
      description="Le novel, tous ses tomes, chapitres et images seront supprimés définitivement."
      action={() => deleteNovel(novelId)}
    />
  );
}

export function DeleteChapterButton({ chapterId, heading }: { chapterId: number; heading: string }) {
  return (
    <ConfirmDelete
      label="Supprimer ce chapitre"
      title={`Supprimer « ${heading} » ?`}
      description="Le texte du chapitre sera supprimé définitivement."
      action={() => deleteChapter(chapterId)}
    />
  );
}
