import { Fragment } from "react";

// Crédits détaillés d’un chapitre, sous son titre : une ligne par ligne de texte ; seuls les liens Markdown
// [texte](https://…) sont interprétés, le reste est affiché tel quel.
export function CreditLines({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  return (
    <div className={className}>
      {lines.map((line, index) => (
        <p key={index}>
          {line.split(/(\[[^\]]+\]\(https?:\/\/[^)\s]+\))/).map((part, i) => {
            const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
            return link ? (
              <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">
                {link[1]}
              </a>
            ) : (
              <Fragment key={i}>{part}</Fragment>
            );
          })}
        </p>
      ))}
    </div>
  );
}
