"use client";

import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/content-meta";
import { cn } from "@/lib/utils";

export type FeaturedSlide = {
  key: string;
  href: string; // fiche du novel
  title: string;
  author: string;
  status: string;
  summary: string;
  quote: string;
  background: string | null;
  logo: string | null;
  chapter: { href: string; label: string } | null; // dernier chapitre publié
};

const DELAY_MS = 8000;

// Carrousel « Recommandé » de l’accueil : une diapositive par novel mis en avant.
// Défilement automatique (en pause au survol, au focus et si l’utilisateur limite les animations).
export function FeaturedCarousel({ slides }: { slides: FeaturedSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => go(index + 1), DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [index, paused, count, go]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="Recommandés"
      className="relative isolate h-[30rem] overflow-hidden border-b border-border bg-secondary md:h-[28rem]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {slides.map((slide, i) => (
        <Slide key={slide.key} slide={slide} active={i === index} position={`${i + 1} sur ${count}`} />
      ))}

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Recommandation précédente"
            className="absolute top-1/2 left-3 z-20 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-background/70 text-foreground backdrop-blur transition-colors hover:bg-background md:grid"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Recommandation suivante"
            className="absolute top-1/2 right-3 z-20 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-white/10 bg-background/70 text-foreground backdrop-blur transition-colors hover:bg-background md:grid"
          >
            <ChevronRight className="size-5" />
          </button>
          <div className="absolute inset-x-0 bottom-5 z-20 flex justify-center gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.key}
                type="button"
                onClick={() => go(i)}
                aria-label={`Afficher ${slide.title}`}
                aria-current={i === index ? "true" : undefined}
                className={cn(
                  "h-2.5 rounded-full transition-all duration-300",
                  i === index ? "w-12 bg-foreground" : "w-2.5 bg-foreground/40 hover:bg-foreground/70",
                )}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Slide({ slide, active, position }: { slide: FeaturedSlide; active: boolean; position: string }) {
  return (
    <div
      role="group"
      aria-roledescription="diapositive"
      aria-label={position}
      aria-hidden={!active}
      inert={!active}
      className={cn("absolute inset-0 transition-opacity duration-700", active ? "z-10 opacity-100" : "z-0 opacity-0")}
    >
      {slide.background && (
        <img
          src={slide.background}
          alt=""
          className="absolute inset-0 -z-20 h-full w-full scale-105 object-cover opacity-45 blur-[3px]"
        />
      )}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-background via-background/75 to-background/20" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-background/80 via-transparent to-transparent" />

      <div className="mx-auto grid h-full max-w-6xl items-center gap-8 px-4 pb-12 sm:px-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:px-16">
        <div className="min-w-0">
          <p className="text-xs font-extrabold tracking-[0.16em] text-primary uppercase">Recommandé</p>
          <h2 className="mt-2 text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            <Link href={slide.href} className="hover:underline hover:decoration-primary/60 hover:underline-offset-8">
              {slide.title}
            </Link>
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <StatusBadge status={slide.status} />
            {slide.author && <span>par {slide.author}</span>}
          </div>
          {slide.summary && <p className="mt-4 line-clamp-3 max-w-2xl text-foreground/85">{slide.summary}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              href={slide.chapter?.href ?? slide.href}
              className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-primary/70 bg-primary/10 px-5 text-sm font-bold text-foreground transition-colors hover:bg-primary hover:text-white"
            >
              <BookOpen className="size-4" aria-hidden />
              {slide.chapter ? `Dernier chapitre (${slide.chapter.label})` : "Voir la fiche"}
            </Link>
            {slide.quote && (
              <blockquote className="rounded-xl border border-white/15 bg-black/30 px-5 py-2 text-lg font-extrabold tracking-tight italic backdrop-blur-sm sm:text-xl">
                « {slide.quote} »
              </blockquote>
            )}
          </div>
        </div>
        {slide.logo && (
          <div className="hidden h-full max-h-[22rem] items-center justify-center md:flex">
            <img src={slide.logo} alt="" className="max-h-full max-w-full object-contain drop-shadow-[0_20px_40px_rgb(0_0_0/0.6)]" />
          </div>
        )}
      </div>
    </div>
  );
}
