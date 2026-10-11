"use client";

// Composant scroll-timeline de Lightswind, adapté pour Saint Eresia (feed d’activité de /gestion) :
// - disposition « rail » (ligne à gauche, cartes pleine largeur) pour un fil dense, en plus de l’alternance d’origine ;
// - contenu riche par événement (`content`), titre de section facultatif, pas de hauteur minimale d’un écran ;
// - couleurs du site uniquement (plus de dégradé ni de lueur codés en dur), sans « comète », pulsation ni parallaxe ;
// - respect de prefers-reduced-motion (ni apparition animée ni ligne de progression animée) ;
// - correction : plus de hook appelé dans une boucle.
import React, { useRef } from "react";
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "./card";

export interface TimelineEvent {
  id?: string;
  /** Date ou repère affiché au-dessus du titre. */
  year: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  description?: React.ReactNode;
  /** Contenu libre sous la description (liste de changements, liens…). */
  content?: React.ReactNode;
  icon?: React.ReactNode;
}

export interface ScrollTimelineProps {
  events: TimelineEvent[];
  title?: string;
  subtitle?: string;
  cardAlignment?: "alternating" | "rail";
  progressIndicator?: boolean;
  revealAnimation?: "fade" | "none";
  spacing?: "compact" | "comfortable";
  className?: string;
}

export const ScrollTimeline = ({
  events,
  title,
  subtitle,
  cardAlignment = "rail",
  progressIndicator = true,
  revealAnimation = "fade",
  spacing = "compact",
  className,
}: ScrollTimelineProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const animate = revealAnimation === "fade" && !reduceMotion;

  // La ligne se remplit à mesure que la frise défile dans la fenêtre.
  const { scrollYProgress } = useScroll({ target: scrollRef, offset: ["start center", "end center"] });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  const progressHeight = useTransform(smoothProgress, [0, 1], ["0%", "100%"]);

  const rail = cardAlignment === "rail";
  const gap = spacing === "compact" ? "space-y-4" : "space-y-12";

  return (
    <div className={cn("relative w-full", className)}>
      {(title || subtitle) && (
        <div className="mb-6">
          {title && <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>}
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      )}

      <div ref={scrollRef} className={cn("relative", rail ? "pl-8 sm:pl-10" : "")}>
        {/* Ligne de fond, puis ligne de progression (couleur principale du site). */}
        <div aria-hidden className={cn("absolute top-0 h-full w-0.5 rounded-full bg-border", rail ? "left-3 sm:left-4" : "left-1/2 -translate-x-1/2")} />
        {progressIndicator && !reduceMotion && (
          <motion.div
            aria-hidden
            className={cn("absolute top-0 w-0.5 rounded-full bg-primary", rail ? "left-3 sm:left-4" : "left-1/2 -translate-x-1/2")}
            style={{ height: progressHeight }}
          />
        )}

        <ol className={cn("relative", gap)}>
          {events.map((event, index) => (
            <li
              key={event.id ?? index}
              className={cn(
                "relative",
                !rail && "flex flex-col lg:flex-row",
                !rail && (index % 2 === 0 ? "lg:justify-start" : "lg:flex-row-reverse lg:justify-start"),
              )}
            >
              {/* Point de la frise */}
              <span
                aria-hidden
                className={cn(
                  "absolute top-5 grid size-4 place-items-center rounded-full border-2 border-primary bg-background",
                  rail ? "-left-[1.375rem] sm:-left-[1.625rem]" : "left-1/2 -translate-x-1/2",
                )}
              />
              <motion.div
                className={cn("w-full", !rail && "lg:w-[calc(50%-2.5rem)]")}
                initial={animate ? { opacity: 0, y: 12 } : false}
                whileInView={animate ? { opacity: 1, y: 0 } : undefined}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <Card>
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      {event.icon}
                      <span>{event.year}</span>
                    </div>
                    <div className="mt-1 font-bold">{event.title}</div>
                    {event.subtitle && <div className="mt-0.5 text-sm text-muted-foreground">{event.subtitle}</div>}
                    {event.description && <div className="mt-2 text-sm text-muted-foreground">{event.description}</div>}
                    {event.content}
                  </CardContent>
                </Card>
              </motion.div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};
