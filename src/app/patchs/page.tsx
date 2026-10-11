import type { Metadata } from "next";
import { PatchListPage } from "@/components/patch/patch-list-page";

export const metadata: Metadata = { title: "Patchs VN" };

export default function PatchesPage() {
  return <PatchListPage kind="vn" />;
}
