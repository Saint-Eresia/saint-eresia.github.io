"use client";

// Composant tabs de Lightswind, adapté pour Saint Eresia :
// - couleurs du site (variables CSS) au lieu des gris et du noir/blanc codés en dur, sans styles 3D ;
// - accessibilité : rôle tablist, onglets reliés à leur panneau (aria-controls / aria-labelledby),
//   navigation aux flèches, Début et Fin, un seul onglet atteignable au Tab (le sélectionné) ;
// - pas d’animation de l’indicateur si l’utilisateur limite les animations ;
// - le changement d’onglet ne peut plus être écrasé par un onClick passé en propriété.
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

interface TabsContextValue {
  baseId: string;
  value: string;
  onValueChange: (value: string) => void;
  updateIndicator: () => void;
  scheduleUpdateIndicator: () => void;
  indicatorStyle: React.CSSProperties;
  mounted: boolean;
  registerTabTrigger: (value: string, element: HTMLButtonElement | null) => void;
  registerTabsList: (element: HTMLDivElement | null) => void;
}

const TabsContext = React.createContext<TabsContextValue>({
  baseId: "",
  value: "",
  onValueChange: () => {},
  updateIndicator: () => {},
  scheduleUpdateIndicator: () => {},
  indicatorStyle: {},
  mounted: false,
  registerTabTrigger: () => {},
  registerTabsList: () => {},
});

const tabId = (baseId: string, value: string) => `${baseId}-onglet-${value}`;
const panelId = (baseId: string, value: string) => `${baseId}-panneau-${value}`;

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, defaultValue, value, onValueChange, children, ...props }, ref) => {
    const baseId = React.useId();
    const [internalValue, setInternalValue] = React.useState(defaultValue || "");
    const [indicatorStyle, setIndicatorStyle] = React.useState<React.CSSProperties>({});
    const [mounted, setMounted] = React.useState(false);
    const tabsListRef = React.useRef<HTMLDivElement | null>(null);
    const tabTriggerRefs = React.useRef(new Map<string, HTMLButtonElement | null>());

    const controlled = value !== undefined;
    const currentValue = controlled ? value : internalValue;

    const registerTabsList = React.useCallback((element: HTMLDivElement | null) => {
      tabsListRef.current = element;
    }, []);

    const registerTabTrigger = React.useCallback((triggerValue: string, element: HTMLButtonElement | null) => {
      if (element) tabTriggerRefs.current.set(triggerValue, element);
      else tabTriggerRefs.current.delete(triggerValue);
    }, []);

    const updateIndicator = React.useCallback(() => {
      if (!tabsListRef.current || !currentValue) return;
      const activeTab = tabTriggerRefs.current.get(currentValue);
      if (!activeTab) return;
      const list = tabsListRef.current;
      const tabRect = activeTab.getBoundingClientRect();
      const listRect = list.getBoundingClientRect();
      // Seulement si les deux éléments sont visibles (dimensions non nulles). La position tient compte
      // de la bordure de la liste et de son défilement horizontal (petits écrans).
      if (tabRect.width > 0 && listRect.width > 0) {
        const left = tabRect.left - listRect.left - list.clientLeft + list.scrollLeft;
        setIndicatorStyle({ left: `${left}px`, width: `${tabRect.width}px` });
      }
    }, [currentValue]);

    const scheduleUpdateIndicator = React.useCallback(() => {
      requestAnimationFrame(() => updateIndicator());
    }, [updateIndicator]);

    React.useEffect(() => {
      setMounted(true);
      scheduleUpdateIndicator();
      window.addEventListener("resize", scheduleUpdateIndicator);
      return () => window.removeEventListener("resize", scheduleUpdateIndicator);
    }, [scheduleUpdateIndicator]);

    // Recalcule l’indicateur quand la liste devient visible (dans une fenêtre ou un menu, par exemple).
    React.useEffect(() => {
      const listEl = tabsListRef.current;
      if (!listEl) return;
      const observer = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) scheduleUpdateIndicator();
      }, { threshold: 0.1 });
      observer.observe(listEl);
      return () => observer.disconnect();
    }, [scheduleUpdateIndicator]);

    const handleValueChange = React.useCallback(
      (newValue: string) => {
        if (!controlled) setInternalValue(newValue);
        onValueChange?.(newValue);
      },
      [controlled, onValueChange],
    );

    return (
      <TabsContext.Provider
        value={{
          baseId,
          value: currentValue,
          onValueChange: handleValueChange,
          updateIndicator,
          scheduleUpdateIndicator,
          indicatorStyle,
          mounted,
          registerTabTrigger,
          registerTabsList,
        }}
      >
        <div ref={ref} className={cn("w-full", className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  },
);
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, onKeyDown, ...props }, ref) => {
  const { indicatorStyle, registerTabsList, mounted } = React.useContext(TabsContext);
  const reduceMotion = useReducedMotion();

  // Flèches gauche/droite, Début et Fin : passe à l’onglet voisin et l’active.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)')];
    const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    const next =
      event.key === "ArrowRight" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length
      : event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
      : -1;
    if (next === -1) return;
    event.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  };

  return (
    <div
      ref={(el) => {
        if (typeof ref === "function") ref(el);
        else if (ref) ref.current = el;
        registerTabsList(el);
      }}
      role="tablist"
      onKeyDown={handleKeyDown}
      className={cn(
        "relative inline-flex h-10 max-w-full items-center overflow-x-auto rounded-full border border-border bg-muted p-1 text-foreground [scrollbar-width:none]",
        className,
      )}
      {...props}
    >
      {mounted && (
        <motion.div
          layout={!reduceMotion}
          aria-hidden
          className="absolute top-1 bottom-1 rounded-full bg-primary"
          style={{ ...indicatorStyle, position: "absolute", zIndex: 0 }}
          transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 300, damping: 30 }}
        />
      )}
      {props.children}
    </div>
  );
});
TabsList.displayName = "TabsList";

const TabsTrigger = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }>(
  ({ className, value, onClick, ...props }, ref) => {
    const { baseId, value: selectedValue, onValueChange, registerTabTrigger, scheduleUpdateIndicator } = React.useContext(TabsContext);
    const isActive = selectedValue === value;
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);

    React.useEffect(() => {
      registerTabTrigger(value, triggerRef.current);
      return () => registerTabTrigger(value, null);
    }, [value, registerTabTrigger]);

    React.useEffect(() => {
      if (isActive) scheduleUpdateIndicator();
    }, [isActive, scheduleUpdateIndicator]);

    return (
      <button
        ref={(el) => {
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
          triggerRef.current = el;
        }}
        type="button"
        role="tab"
        id={tabId(baseId, value)}
        aria-selected={isActive}
        aria-controls={panelId(baseId, value)}
        tabIndex={isActive ? 0 : -1}
        data-state={isActive ? "active" : "inactive"}
        data-value={value}
        className={cn(
          "relative z-10 inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 py-1 text-sm whitespace-nowrap sm:px-3.5 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
          isActive ? "font-bold text-primary-foreground" : "font-semibold text-muted-foreground hover:text-foreground",
          className,
        )}
        {...props}
        onClick={(event) => {
          onValueChange(value);
          onClick?.(event);
        }}
      />
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

const TabsContent = React.forwardRef<HTMLDivElement, { value: string } & React.ComponentPropsWithoutRef<"div">>(
  ({ className, value, ...props }, ref) => {
    const { baseId, value: selectedValue, updateIndicator } = React.useContext(TabsContext);
    const isActive = selectedValue === value;
    const contentRef = React.useRef<HTMLDivElement | null>(null);

    // Recalcule l’indicateur quand le contenu change de taille.
    React.useEffect(() => {
      if (!isActive || !contentRef.current) return;
      const observer = new ResizeObserver(() => updateIndicator());
      observer.observe(contentRef.current);
      return () => observer.disconnect();
    }, [isActive, updateIndicator]);

    if (!isActive) return null;
    return (
      <div
        ref={(el) => {
          contentRef.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        role="tabpanel"
        id={panelId(baseId, value)}
        aria-labelledby={tabId(baseId, value)}
        tabIndex={0}
        data-state="active"
        data-value={value}
        className={cn("mt-6 w-full focus-visible:outline-none", className)}
        {...props}
      />
    );
  },
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent };
