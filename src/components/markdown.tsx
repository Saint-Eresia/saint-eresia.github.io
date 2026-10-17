import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Le HTML brut n’est pas interprété : seul le Markdown est rendu.
// `reader` : mise en page de lecture des chapitres, où un retour à la ligne simple est conservé.
export function Markdown({ children, reader = false }: { children: string; reader?: boolean }) {
  return (
    <div className={cn("prose-patch", reader && "prose-reader")}>
      <ReactMarkdown
        remarkPlugins={reader ? [remarkGfm, remarkBreaks] : [remarkGfm]}
        components={{
          // Liens internes (« /novels/… ») dans le même onglet, liens externes dans un nouvel onglet.
          a: ({ href, children }) =>
            href?.startsWith("/") && !href.startsWith("//") ? (
              <a href={href}>{children}</a>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ),
          img: ({ src, alt }) => <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} loading="lazy" />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
