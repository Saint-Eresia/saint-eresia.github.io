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
