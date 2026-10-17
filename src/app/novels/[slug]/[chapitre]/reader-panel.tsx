"use client";

import { Images, Minus, Plus, RotateCcw, Settings2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { readProgress, RESUME_HASH, writeProgress } from "@/lib/reading-progress";
import { cn } from "@/lib/utils";
import { ImageLightbox } from "./image-lightbox";

// Réglages de lecture, propres à chaque lecteur et conservés dans son navigateur (localStorage).
// theme : « site » (clair ou sombre, selon le choix du site) ou « sepia » (fond papier, propre à la lecture).
type Settings = { font: FontKey; size: number; leading: number; tracking: number; align: "left" | "justify"; theme: "site" | "sepia" };
type FontKey = "sans" | "serif" | "system";

const FONTS: Record<FontKey, { label: string; family: string }> = {
  sans: { label: "Sans-serif", family: "var(--font-urbanist), sans-serif" },
  serif: { label: "Serif", family: "var(--font-literata), Georgia, serif" },
  system: { label: "Police du système", family: "system-ui, sans-serif" },
};
const DEFAULTS: Settings = { font: "sans", size: 18, leading: 1.8, tracking: 0, align: "left", theme: "site" };
const LIMITS = { size: [14, 30, 1], leading: [1.2, 2.6, 0.1], tracking: [0, 3, 0.5] } as const;
const STORAGE_KEY = "lecture:options";
const OPEN_KEY = "lecture:panneau";

const clamp = (key: keyof typeof LIMITS, value: number) => {
  const [min, max, step] = LIMITS[key];
  return Math.min(max, Math.max(min, Math.round(value / step) * step));
};

// Petit magasin partagé : la valeur en mémoire fait foi, le localStorage n’est qu’une sauvegarde
// (il peut être indisponible, en navigation privée par exemple).
let current: Settings | null = null;
const listeners = new Set<() => void>();
function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Settings>;
    return {
      font: saved.font && saved.font in FONTS ? saved.font : DEFAULTS.font,
      size: typeof saved.size === "number" ? clamp("size", saved.size) : DEFAULTS.size,
      leading: typeof saved.leading === "number" ? clamp("leading", saved.leading) : DEFAULTS.leading,
      tracking: typeof saved.tracking === "number" ? clamp("tracking", saved.tracking) : DEFAULTS.tracking,
      align: saved.align === "justify" ? "justify" : "left",
      theme: saved.theme === "sepia" ? "sepia" : "site",
    };
  } catch {
    return DEFAULTS;
  }
}
const snapshot = () => (current ??= load());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
function save(next: Settings) {
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {}
  listeners.forEach((listener) => listener());
}
// Panneau rouvert d’un chapitre à l’autre s’il était resté ouvert.
let panelOpen: boolean | null = null;
const openSnapshot = () => {
  if (panelOpen === null) {
    try {
      panelOpen = localStorage.getItem(OPEN_KEY) === "1";
    } catch {
      panelOpen = false;
    }
  }
  return panelOpen;
};
function setPanelOpen(next: boolean) {
  panelOpen = next;
  try {
    localStorage.setItem(OPEN_KEY, next ? "1" : "0");
  } catch {}
  listeners.forEach((listener) => listener());
}

export type ReaderImage = { src: string; alt: string };

// Texte du chapitre mis en forme selon les réglages, avec le panneau « Options » / « Illustrations ».
// Mémorise aussi le chapitre et le bloc de texte atteint (« Reprendre la lecture » sur la fiche du novel).
export function ReaderPanel({
  images,
  novelSlug,
  chapter,
  previousHref,
  nextHref,
  children,
}: {
  images: ReaderImage[];
  novelSlug: string;
  chapter: { slug: string; heading: string };
  previousHref: string | null;
  nextHref: string | null;
  children: ReactNode;
}) {
  const settings = useSyncExternalStore(subscribe, snapshot, () => DEFAULTS);
  const open = useSyncExternalStore(subscribe, openSnapshot, () => false);
  const [tab, setTab] = useState<"options" | "illustrations">("options");
  const [zoomed, setZoomed] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const router = useRouter();

  // ← / → : chapitre précédent / suivant (sauf dans un champ, ou avec une touche de modification).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      const href = e.key === "ArrowLeft" ? previousHref : e.key === "ArrowRight" ? nextHref : null;
      if (href) router.push(href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previousHref, nextHref, router]);

  // Fond sépia : variables de couleur du site redéfinies sur <html> le temps de la lecture.
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "sepia") root.dataset.readerTheme = "sepia";
    else delete root.dataset.readerTheme;
    return () => {
      delete root.dataset.readerTheme;
    };
  }, [settings.theme]);

  // Barre de progression : part du texte du chapitre déjà parcourue.
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const box = content.current?.getBoundingClientRect();
      if (!box) return;
      const span = box.height - window.innerHeight * 0.6;
      setProgress(span > 0 ? Math.min(1, Math.max(0, -box.top / span)) : 1);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  const content = useRef<HTMLDivElement>(null);

  const toggle = setPanelOpen;

  // Reprise : retour au bloc mémorisé si l’on arrive par « Reprendre la lecture », puis suivi du défilement.
  useEffect(() => {
    const blocks = () => Array.from(content.current?.querySelector(".prose-reader")?.children ?? []);
    let frame = 0;
    let started = false;
    // Bloc le plus avancé atteint pendant la visite : remonter en haut de page (menu, sommaire) ne l’efface pas.
    let furthest = 0;
    const record = () => {
      frame = 0;
      // Premier bloc dont le bas dépasse l’en-tête du site (environ 5 rem).
      furthest = Math.max(furthest, blocks().findIndex((block) => block.getBoundingClientRect().bottom > 80));
      writeProgress(novelSlug, { slug: chapter.slug, heading: chapter.heading, block: furthest, at: Date.now() });
    };
    const onScroll = () => {
      if (started && !frame) frame = requestAnimationFrame(record);
    };
    // Le suivi ne démarre qu’après le retour au passage mémorisé, pour ne pas l’écraser.
    const start = requestAnimationFrame(() => {
      if (window.location.hash === RESUME_HASH) {
        const saved = readProgress(novelSlug);
        if (saved?.slug === chapter.slug) {
          furthest = saved.block;
          blocks()[saved.block]?.scrollIntoView({ block: "start" });
        }
        history.replaceState(history.state, "", window.location.pathname + window.location.search);
      }
      started = true;
      record();
    });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(start);
      cancelAnimationFrame(frame);
    };
  }, [novelSlug, chapter.slug, chapter.heading]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanelOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => save({ ...settings, [key]: value });
  const step = (key: keyof typeof LIMITS, direction: 1 | -1) => set(key, clamp(key, settings[key] + direction * LIMITS[key][2]));
  const goTo = (index: number) => {
    content.current?.querySelectorAll("img")[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!window.matchMedia("(min-width: 1024px)").matches) toggle(false);
  };

  const style = {
    "--reader-font": FONTS[settings.font].family,
    "--reader-size": `${settings.size}px`,
    "--reader-leading": settings.leading,
    "--reader-tracking": `${settings.tracking}px`,
    "--reader-align": settings.align,
    "--reader-hyphens": settings.align === "justify" ? "auto" : "manual",
  } as CSSProperties;

  return (
    <>
      {/* Clic sur une illustration : affichage en plein écran. */}
      <div
        ref={content}
        style={style}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.tagName !== "IMG") return;
          const index = Array.from(content.current?.querySelectorAll("img") ?? []).indexOf(target as HTMLImageElement);
          if (index >= 0) setZoomed(index);
        }}
      >
        {children}
      </div>
      <ImageLightbox images={images} index={zoomed} onChange={setZoomed} />
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[55] h-[3px]">
        <div className="h-full origin-left bg-primary transition-transform duration-150" style={{ transform: `scaleX(${progress})` }} />
      </div>

      {!open && (
        <button
          type="button"
          onClick={() => toggle(true)}
          className="fixed bottom-5 left-5 z-40 flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm font-semibold shadow-[0_12px_40px_var(--shadow)] transition-colors hover:text-primary"
        >
          <Settings2 className="size-4" /> Options de lecture
        </button>
      )}

      {open && (
        <aside
          aria-label="Options de lecture"
          className="fixed inset-x-3 bottom-3 z-40 flex max-h-[75vh] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_18px_50px_var(--shadow)] lg:inset-x-auto lg:top-24 lg:bottom-auto lg:left-5 lg:max-h-[calc(100vh-8rem)] lg:w-72"
        >
          <div className="flex items-center gap-1 border-b border-border p-2">
            <TabButton active={tab === "options"} onClick={() => setTab("options")}>
              <Settings2 className="size-4" /> Options
            </TabButton>
            {images.length > 0 && (
              <TabButton active={tab === "illustrations"} onClick={() => setTab("illustrations")}>
                <Images className="size-4" /> Illustrations <span className="text-xs text-muted-foreground">{images.length}</span>
              </TabButton>
            )}
            <button
              type="button"
              onClick={() => toggle(false)}
              aria-label="Fermer les options de lecture"
              className="ml-auto rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="overflow-y-auto p-4">
            {tab === "options" || images.length === 0 ? (
              <div className="space-y-4">
                <Field label="Police">
                  <select
                    value={settings.font}
                    onChange={(e) => set("font", e.target.value as FontKey)}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    {Object.entries(FONTS).map(([key, font]) => (
                      <option key={key} value={key}>
                        {font.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Stepper label="Taille" value={`${settings.size}px`} onStep={(d) => step("size", d)} minus="A−" plus="A+" />
                <Stepper label="Interligne" value={settings.leading.toFixed(1)} onStep={(d) => step("leading", d)} />
                <Stepper label="Lettrage" value={`${settings.tracking}px`} onStep={(d) => step("tracking", d)} />
                <Field label="Fond">
                  <select
                    value={settings.theme}
                    onChange={(e) => set("theme", e.target.value as Settings["theme"])}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="site">Celui du site (clair ou sombre)</option>
                    <option value="sepia">Sépia</option>
                  </select>
                </Field>
                <Field label="Alignement">
                  <select
                    value={settings.align}
                    onChange={(e) => set("align", e.target.value as Settings["align"])}
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                  >
                    <option value="left">Aligner à gauche</option>
                    <option value="justify">Justifier</option>
                  </select>
                </Field>
                <button
                  type="button"
                  onClick={() => save(DEFAULTS)}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted"
                >
                  <RotateCcw className="size-4" /> Réinitialiser
                </button>
              </div>
            ) : (
              <ol className="grid grid-cols-2 gap-3">
                {images.map((image, index) => (
                  <li key={image.src + index}>
                    <button
                      type="button"
                      onClick={() => goTo(index)}
                      className="group block w-full overflow-hidden rounded-lg border border-border text-left transition-colors hover:border-primary"
                    >
                      <img src={image.src} alt={image.alt} loading="lazy" className="aspect-[3/4] w-full object-cover" />
                      <span className="block px-2 py-1 text-xs font-semibold text-muted-foreground group-hover:text-primary">
                        Illustration {index + 1}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      )}
    </>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold transition-colors",
        active ? "bg-muted text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-bold">{label}</span>
      {children}
    </label>
  );
}

function Stepper({
  label,
  value,
  onStep,
  minus,
  plus,
}: {
  label: string;
  value: string;
  onStep: (direction: 1 | -1) => void;
  minus?: string;
  plus?: string;
}) {
  const square = "flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-sm font-bold transition-colors hover:bg-muted";
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-bold">{label}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onStep(-1)} className={square} aria-label={`${label} : diminuer`}>
          {minus ?? <Minus className="size-4" />}
        </button>
        <output className="flex h-10 flex-1 items-center justify-center rounded-lg bg-muted text-sm font-semibold">{value}</output>
        <button type="button" onClick={() => onStep(1)} className={square} aria-label={`${label} : augmenter`}>
          {plus ?? <Plus className="size-4" />}
        </button>
      </div>
    </div>
  );
}
