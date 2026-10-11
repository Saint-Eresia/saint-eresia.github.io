"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/lightswind/tabs";

export type GestionTab = { value: string; label: string; count?: number };

// Onglets de /gestion. Le changement d’onglet est instantané (tous les panneaux sont déjà rendus côté serveur)
// et se reflète dans l’adresse (?onglet=…) pour pouvoir partager le lien ou y revenir après un enregistrement.
export function GestionTabs({ tabs, initial, children }: { tabs: GestionTab[]; initial: string; children: React.ReactNode }) {
  const [value, setValue] = useState(initial);

  const select = (next: string) => {
    setValue(next);
    const url = new URL(window.location.href);
    // Les filtres et la page du feed ne concernent que l’onglet Activité.
    url.search = next === tabs[0].value ? "" : `?onglet=${next}`;
    window.history.replaceState(null, "", url);
  };

  return (
    <Tabs value={value} onValueChange={select} className="mt-8">
      <TabsList aria-label="Sections de la gestion">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-xs tabular-nums opacity-80 max-sm:sr-only">
                <span className="sr-only">(</span>
                {tab.count}
                <span className="sr-only">)</span>
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
