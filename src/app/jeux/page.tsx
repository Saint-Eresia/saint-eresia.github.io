import type { Metadata } from "next";
import { PatchListPage } from "@/components/patch/patch-list-page";

export const metadata: Metadata = { title: "Jeux" };

export default function GamesPage() {
  return <PatchListPage kind="jeu" />;
}
