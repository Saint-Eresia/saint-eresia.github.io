import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { canSeeNovel, getVolumeIllustrations, isPublicNovel, volumeHeading } from "@/lib/novels";
import { getViewer } from "@/lib/viewer";
import { IllustrationGallery } from "./illustration-gallery";

type Props = PageProps<"/novels/[slug]/illustrations/[tome]">;

async function load(params: Props["params"]) {
  const { slug, tome } = await params;
  const data = await getVolumeIllustrations(slug, Number(tome));
  return data && (await canSeeNovel(data.novel)) ? data : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  if (!data) return { title: "Illustrations introuvables" };
  return {
    title: `Illustrations · ${volumeHeading(data.volume)} · ${data.novel.title}`,
    robots: isPublicNovel(data.novel) ? undefined : { index: false },
  };
}

export default function IllustrationsPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-6xl animate-pulse" />}>
      <Illustrations params={params} />
    </Suspense>
  );
}

// Toutes les illustrations d’un tome (ou d’un arc), dans l’ordre de lecture, chacune reliée à son chapitre.
async function Illustrations({ params }: { params: Props["params"] }) {
  const data = await load(params);
  if (!data || data.images.length === 0) notFound();
  const { novel, volume, images } = data;
  // L’équipe peut retirer une illustration de son chapitre depuis cette page.
  const canEdit = !!(await getViewer())?.isTeam;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link
        href={`/novels/${novel.slug}`}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {novel.title}
      </Link>
      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Illustrations</h1>
      <p className="mt-2 text-muted-foreground">
        {volumeHeading(volume)} · {images.length} illustration{images.length > 1 ? "s" : ""}
      </p>
      <IllustrationGallery novelId={canEdit ? novel.id : undefined} novelSlug={novel.slug} images={images} />
    </div>
  );
}
