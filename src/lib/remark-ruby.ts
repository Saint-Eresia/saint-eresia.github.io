// Furigana dans le Markdown des chapitres : « {菜月|Natsuki} » s’affiche en <ruby>菜月<rt>Natsuki</rt></ruby>
// (lecture au-dessus du texte), le HTML brut n’étant pas interprété.
type MdNode = { type: string; value?: string; children?: MdNode[]; data?: { hName?: string } };

const RUBY = /\{([^{}|\n]+)\|([^{}|\n]+)\}/g;

function split(text: string): MdNode[] {
  const out: MdNode[] = [];
  let last = 0;
  for (const match of text.matchAll(RUBY)) {
    if (match.index > last) out.push({ type: "text", value: text.slice(last, match.index) });
    out.push({
      type: "ruby",
      data: { hName: "ruby" },
      children: [
        { type: "text", value: match[1] },
        { type: "rubyText", data: { hName: "rt" }, children: [{ type: "text", value: match[2] }] },
      ],
    });
    last = match.index + match[0].length;
  }
  if (last < text.length) out.push({ type: "text", value: text.slice(last) });
  return out;
}

function walk(node: MdNode) {
  if (!node.children) return;
  node.children = node.children.flatMap((child) => {
    if (child.type === "text" && child.value?.includes("|")) return split(child.value);
    walk(child);
    return [child];
  });
}

export function remarkRuby() {
  return (tree: MdNode) => walk(tree);
}
