"use client";

import { useEffect, useState } from "react";
import { visitorCounts } from "./visitor-actions";

// Visiteurs uniques du pied de page. Le navigateur tire un identifiant aléatoire (gardé dans localStorage) et
// ne s’annonce qu’une fois par jour ; le reste du temps, les compteurs sont seulement lus.
const ID_KEY = "visiteur";
const DAY_KEY = "visiteur:jour";

type Stats = Awaited<ReturnType<typeof visitorCounts>>;

const number = (value: number) => value.toLocaleString("fr-FR");

export function VisitorStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let store: Storage | null = null;
    let id: string | null = null;
    let announce = false;
    const day = new Date().toLocaleDateString("sv-SE");
    // Stockage bloqué : pas d’identifiant durable, la visite n’est pas comptée (les compteurs restent affichés).
    try {
      store = window.localStorage;
      id = store.getItem(ID_KEY);
      if (!id) {
        id = crypto.randomUUID();
        store.setItem(ID_KEY, id);
      }
      announce = store.getItem(DAY_KEY) !== day;
    } catch {
      store = null;
    }

    let active = true;
    visitorCounts(announce ? id : null)
      .then((result) => {
        if (!active) return;
        setStats(result);
        if (announce) {
          try {
            store?.setItem(DAY_KEY, day);
          } catch {}
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Place réservée avant la réponse : le pied de page ne bouge pas.
  return (
    <p className={`tabular-nums ${stats ? "" : "invisible"}`}>
      Total visiteurs uniques : {number(stats?.total ?? 0)}
      <span aria-hidden className="mx-2">
        ·
      </span>
      Visiteurs aujourd’hui : {number(stats?.today ?? 0)}
    </p>
  );
}
