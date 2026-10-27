"use server";

import { headers } from "next/headers";
import { reportTypo } from "@/lib/discord";
import { chapterHeading, getPublishedChapter, isPublicNovel } from "@/lib/novels";

export type TypoReportState = { sent?: boolean; error?: string };

// Signalements récents par adresse IP (au plus 5 par quart d’heure). En mémoire : propre à chaque instance du
// serveur, ce n’est qu’un garde-fou contre les envois en rafale.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REPORTS = 5;
const recent = new Map<string, number[]>();

function tooMany(ip: string) {
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((time) => now - time < WINDOW_MS);
  if (times.length >= MAX_REPORTS) return true;
  recent.set(ip, [...times, now]);
  if (recent.size > 1000) recent.clear();
  return false;
}

const text = (formData: FormData, name: string, max: number) => String(formData.get(name) ?? "").trim().slice(0, max);

// « Signaler une coquille » sous un chapitre : envoyé à l’équipe sur Discord, rien n’est enregistré sur le site.
export async function sendTypoReport(_previous: TypoReportState, formData: FormData): Promise<TypoReportState> {
  // Champ invisible rempli seulement par les robots : on fait comme si l’envoi avait réussi.
  if (text(formData, "site", 200)) return { sent: true };
  const comment = text(formData, "remarque", 1000);
  if (!comment) return { error: "Décrivez la coquille ou la correction proposée." };

  const data = await getPublishedChapter(text(formData, "novel", 200), text(formData, "chapitre", 200));
  if (!data || !isPublicNovel(data.novel)) return { error: "Chapitre introuvable." };

  const ip = ((await headers()).get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (tooMany(ip)) return { error: "Trop de signalements d’un coup : réessayez dans quelques minutes." };

  const sent = await reportTypo({
    title: `${data.novel.title} · ${chapterHeading(data.chapter)}`,
    path: `/novels/${data.novel.slug}/${data.chapter.slug}`,
    passage: text(formData, "passage", 1000),
    comment,
    name: text(formData, "pseudo", 60),
  });
  return sent ? { sent: true } : { error: "Envoi impossible pour le moment. Vous pouvez aussi prévenir l’équipe sur Discord." };
}
