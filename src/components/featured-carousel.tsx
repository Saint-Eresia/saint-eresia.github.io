"use client";

import { BookOpen, ChevronLeft, ChevronRight, Download } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { statusTone } from "@/components/content-meta";
import { Badge } from "@/components/lightswind/badge";
import { CountUp } from "@/components/lightswind/count-up";
import { Progress } from "@/components/lightswind/progress";
import { cn } from "@/lib/utils";

export type FeaturedSlide = {
  key: string;
  kindLabel: string; // « Light novel », « Patch VN »…
  href: string; // fiche publique
  title: string;
  byline: string; // ex. « par Nagaru Tanigawa » (novels)
  status: string;
  summary: string;
  quote: string;
  background: string | null;
  logo: string | null;
  // Bouton principal : dernier chapitre d’un novel, téléchargement d’un patch.
  action: { href: string; label: string; kind: "read" | "download" } | null;
  // Patchs : avancement global et étapes.
  progress: { value: number; steps: { label: string; value: number }[] } | null;
};

const barColor = (value: number) => (value >= 100 ? "bg-success" : "bg-primary");

// Carrousel « Recommandé » de l’accueil : novels et patchs recommandés, tirés au hasard à chaque chargement.
// Défilement automatique toutes les `delaySeconds` (en pause au survol, au focus et si l’utilisateur limite les animations).
export function FeaturedCarousel({ slides, delaySeconds = 8 }: { slides: FeaturedSlide[]; delaySeconds?: number }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setTimeout(() => go(index + 1), delaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [index, paused, count, go, delaySeconds]);

  if (count === 0) return null;

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="Recommandés"
      className="relative isolate h-[36rem] overflow-hidden border-b border-border bg-secondary sm:h-[34rem] lg:h-[35rem]"
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
            className="absolute top-1/2 left-3 z-20 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/70 text-foreground backdrop-blur transition-colors hover:bg-background md:grid"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Recommandation suivante"
            className="absolute top-1/2 right-3 z-20 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-border bg-background/70 text-foreground backdrop-blur transition-colors hover:bg-background md:grid"
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
  const ActionIcon = slide.action?.kind === "download" ? Download : BookOpen;
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

      <div className="mx-auto grid h-full max-w-6xl items-center gap-8 px-4 pb-12 sm:px-6 md:px-16 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="text-xs font-extrabold tracking-[0.16em] text-primary uppercase">
            Recommandé <span className="text-muted-foreground">· {slide.kindLabel}</span>
          </p>
          <h2 className="mt-2 text-3xl leading-tight font-extrabold tracking-tight text-balance sm:text-4xl xl:text-5xl">
            <Link href={slide.href} className="hover:underline hover:decoration-primary/60 hover:underline-offset-8">
              {slide.title}
            </Link>
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <Badge variant="unstyled" withDot className={cn("border-transparent", statusTone(slide.status))}>
              {slide.status}
            </Badge>
            {slide.byline && <span>{slide.byline}</span>}
          </div>
          {slide.summary && (
            <p className={cn("mt-4 max-w-2xl text-foreground/85", slide.progress ? "line-clamp-2" : "line-clamp-3")}>{slide.summary}</p>
          )}

          {slide.progress && (
            <div className="mt-4 max-w-xl">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-muted-foreground">Avancement</span>
                <CountUp value={slide.progress.value} suffix="%" duration={1.2} className="text-2xl font-extrabold tabular-nums" />
              </div>
              <Progress
                value={slide.progress.value}
                size="sm"
                className="mt-1.5 bg-muted/80"
                indicatorClassName={barColor(slide.progress.value)}
                aria-label={`Avancement global : ${slide.progress.value} %`}
              />
              {slide.progress.steps.length > 0 && (
                <dl className="mt-3 hidden gap-x-6 gap-y-2 sm:grid sm:grid-cols-2">
                  {slide.progress.steps.slice(0, 4).map((step) => (
                    <div key={step.label}>
                      <div className="flex items-baseline justify-between gap-3 text-xs">
                        <dt className="truncate text-muted-foreground">{step.label}</dt>
                        <dd className="font-bold tabular-nums">{step.value} %</dd>
                      </div>
                      <Progress
                        value={step.value}
                        size="sm"
                        className="mt-1 h-1 bg-muted/80"
                        indicatorClassName={barColor(step.value)}
                        aria-label={`${step.label} : ${step.value} %`}
                      />
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-4">
            {slide.action ? (
              slide.action.kind === "download" ? (
                <a
                  href={slide.action.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-primary/70 bg-primary/10 px-5 text-sm font-bold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <ActionIcon className="size-4" aria-hidden />
                  {slide.action.label}
                </a>
              ) : (
                <Link
                  href={slide.action.href}
                  className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-primary/70 bg-primary/10 px-5 text-sm font-bold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
                >
                  <ActionIcon className="size-4" aria-hidden />
                  {slide.action.label}
                </Link>
              )
            ) : (
              <Link
                href={slide.href}
                className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-primary/70 bg-primary/10 px-5 text-sm font-bold text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                Voir la fiche
              </Link>
            )}
            {slide.quote && (
              <blockquote className="rounded-xl border border-border-strong bg-background/60 px-5 py-2 text-lg font-extrabold tracking-tight italic backdrop-blur-sm sm:text-xl">
                « {slide.quote} »
              </blockquote>
            )}
          </div>
        </div>
        {slide.logo && (
          <div className="hidden h-full max-h-[22rem] items-center justify-center lg:flex">
            <img src={slide.logo} alt="" className="max-h-full max-w-full object-contain drop-shadow-[0_20px_40px_var(--shadow)]" />
          </div>
        )}
      </div>
    </div>
  );
}
