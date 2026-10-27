import "server-only";
import { cacheLife } from "next/cache";

// Pages boutique du jeu original, pour les liens « Acheter sur … » des fiches patch.
export const steamStoreUrl = (appId: number) => `https://store.steampowered.com/app/${appId}/`;

// GOG n’a pas d’adresse de boutique par identifiant : l’API publique des produits donne celle de la fiche.
// Gardée en cache ; si GOG ne répond pas, la fiche GOG Database du jeu (qui mène à la boutique).
export async function gogStoreUrl(productId: number) {
  "use cache";
  cacheLife("weeks");
  try {
    const response = await fetch(`https://api.gog.com/products/${productId}`, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const card = ((await response.json()) as { links?: { product_card?: unknown } }).links?.product_card;
      if (typeof card === "string" && card.startsWith("https://www.gog.com/")) return card;
    }
  } catch {}
  return `https://www.gogdb.org/product/${productId}`;
}
