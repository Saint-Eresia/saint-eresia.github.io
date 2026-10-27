import "server-only";
import { siteUrl } from "@/lib/site-url";

// Annonce sur Discord (webhook d’un salon) d’un chapitre ou d’une actualité tout juste publiés.
// Sans DISCORD_WEBHOOK_URL (à créer dans Discord : Paramètres du salon → Intégrations → Webhooks), rien n’est envoyé.
// Une annonce qui échoue ne bloque jamais l’enregistrement : l’erreur est seulement journalisée.

export async function announce({ title, path, description, image }: { title: string; path: string; description?: string; image?: string | null }) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return;
  const url = `${siteUrl()}${path}`;
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "Saint Eresia",
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: title.slice(0, 256),
            url,
            description: description?.slice(0, 400),
            color: 0xe43a44,
            ...(image ? { thumbnail: { url: image.startsWith("http") ? image : `${siteUrl()}${image}` } } : {}),
          },
        ],
      }),
    });
    if (!response.ok) console.error(`Annonce Discord refusée (${response.status}) : ${await response.text()}`);
  } catch (error) {
    console.error("Annonce Discord impossible :", error);
  }
}

// Coquille signalée par un lecteur, envoyée au salon de l’équipe (webhook DISCORD_REPORT_WEBHOOK_URL, distinct de
// celui des annonces). Renvoie false si l’envoi n’a pas pu se faire (webhook absent ou refus de Discord).
export async function reportTypo({ title, path, passage, comment, name }: { title: string; path: string; passage: string; comment: string; name: string }) {
  const webhook = process.env.DISCORD_REPORT_WEBHOOK_URL;
  if (!webhook) return false;
  const field = (fieldName: string, value: string) => ({ name: fieldName, value: value.slice(0, 1024) });
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        username: "Saint Eresia — coquilles",
        allowed_mentions: { parse: [] },
        embeds: [
          {
            title: `Coquille signalée : ${title}`.slice(0, 256),
            url: `${siteUrl()}${path}`,
            color: 0xe43a44,
            fields: [
              ...(passage ? [field("Passage", passage)] : []),
              field("Remarque", comment),
              ...(name ? [field("Signalé par", name)] : []),
            ],
          },
        ],
      }),
    });
    if (!response.ok) console.error(`Signalement Discord refusé (${response.status}) : ${await response.text()}`);
    return response.ok;
  } catch (error) {
    console.error("Signalement Discord impossible :", error);
    return false;
  }
}
