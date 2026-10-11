import type { Metadata } from "next";
import { PatchDetailPage, patchMetadata } from "@/components/patch/patch-detail";

export function generateMetadata({ params }: PageProps<"/patchs/[slug]">): Promise<Metadata> {
  return patchMetadata(params);
}

export default function PatchPage({ params }: PageProps<"/patchs/[slug]">) {
  return <PatchDetailPage params={params} kind="vn" />;
}
