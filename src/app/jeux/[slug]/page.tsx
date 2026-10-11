import type { Metadata } from "next";
import { PatchDetailPage, patchMetadata } from "@/components/patch/patch-detail";

export function generateMetadata({ params }: PageProps<"/jeux/[slug]">): Promise<Metadata> {
  return patchMetadata(params);
}

export default function GamePage({ params }: PageProps<"/jeux/[slug]">) {
  return <PatchDetailPage params={params} kind="jeu" />;
}
