import "server-only";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { Element, ElementContent, Root, RootContent } from "hast";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import sharp from "sharp";
import { unified } from "unified";
import { UPLOAD_DIR } from "@/lib/db";
import { chapterHeading, volumeHeading, type Chapter, type Novel, type NovelImage, type Volume } from "@/lib/novels";
import { zip, type ZipEntry } from "@/lib/zip";

// EPUB 3 d’un tome (avec table des matières EPUB 2 pour les vieilles liseuses) : couverture, page de titre et
// crédits, un fichier par chapitre, illustrations converties en JPEG (format lu par toutes les liseuses).
// Changer EPUB_VERSION invalide les EPUB déjà générés (voir epubKey).
const EPUB_VERSION = 1;

export type EpubInput = {
  novel: Pick<Novel, "title" | "originalTitle" | "author" | "artist" | "slug">;
  cover: Pick<NovelImage, "file"> | null;
  volume: Pick<Volume, "id" | "number" | "label" | "title" | "note">;
  chapters: Pick<Chapter, "id" | "slug" | "label" | "title" | "content" | "translators" | "updatedAt">[];
  siteUrl: string;
};

// Empreinte du contenu : un tome modifié (chapitre, titre, couverture…) donne un nouvel EPUB.
export function epubKey({ novel, cover, volume, chapters }: EpubInput) {
  const hash = createHash("sha256");
  hash.update(JSON.stringify([EPUB_VERSION, novel, cover?.file ?? "", volume, chapters.map((c) => [c.id, c.updatedAt, c.label, c.title, c.translators])]));
  return hash.digest("hex").slice(0, 24);
}

export function epubFileName({ novel, volume }: Pick<EpubInput, "novel" | "volume">) {
  return `${novel.title} - ${volumeHeading(volume)}.epub`.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ");
}

// ——— Markdown → XHTML ———

const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkBreaks).use(remarkRehype);
const VOID = new Set(["br", "hr", "img", "input", "col", "area", "base", "link", "meta", "wbr"]);
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttr = (text: string) => escape(text).replace(/"/g, "&quot;");

function attributes(properties: Element["properties"]) {
  return Object.entries(properties ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => {
      const name = key === "className" ? "class" : key === "htmlFor" ? "for" : key.toLowerCase();
      return ` ${name}="${escapeAttr(Array.isArray(value) ? value.join(" ") : String(value))}"`;
    })
    .join("");
}

function serialize(node: Root | RootContent | ElementContent): string {
  if (node.type === "root") return node.children.map(serialize).join("");
  if (node.type === "text") return escape(node.value);
  if (node.type !== "element") return "";
  const attrs = attributes(node.properties);
  if (VOID.has(node.tagName)) return `<${node.tagName}${attrs}/>`;
  return `<${node.tagName}${attrs}>${node.children.map(serialize).join("")}</${node.tagName}>`;
}

// Parcourt les images d’un arbre HTML pour en remplacer l’adresse.
function mapImages(node: Root | ElementContent, replace: (src: string) => string) {
  if (node.type === "element" && node.tagName === "img" && typeof node.properties.src === "string") {
    node.properties.src = replace(node.properties.src);
    node.properties.alt ??= "";
  }
  if ("children" in node) for (const child of node.children) mapImages(child as ElementContent, replace);
}

const toXhtml = (source: string, replaceImage: (src: string) => string) => {
  const tree = markdown.runSync(markdown.parse(source)) as Root;
  mapImages(tree, replaceImage);
  return serialize(tree);
};

// ——— Images ———

async function readImage(src: string): Promise<Buffer> {
  const local = src.match(/^\/uploads\/([0-9a-f-]{36}\.webp)$/);
  if (local) return fs.readFile(path.join(UPLOAD_DIR, local[1]));
  const response = await fetch(src);
  if (!response.ok) throw new Error(`image introuvable (${response.status}) : ${src}`);
  return Buffer.from(await response.arrayBuffer());
}

const toJpeg = (data: Buffer, maxHeight: number) =>
  sharp(data, { limitInputPixels: 100_000_000 })
    .flatten({ background: "#ffffff" })
    .resize({ width: 1600, height: maxHeight, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

// ——— Gabarits ———

const page = (title: string, body: string, bodyClass = "") => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="fr" lang="fr">
<head><meta charset="utf-8"/><title>${escape(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>
${body}
</body>
</html>
`;

const STYLE = `body { margin: 0 0.4em; line-height: 1.5; text-align: justify; hyphens: auto; -webkit-hyphens: auto; }
h1 { font-size: 1.4em; text-align: center; margin: 1.5em 0 0.4em; line-height: 1.25; hyphens: none; }
h2, h3 { text-align: center; hyphens: none; }
p { margin: 0 0 0.7em; text-indent: 0; }
p.credit { text-align: center; font-size: 0.85em; font-style: italic; margin-bottom: 2em; }
hr { border: 0; text-align: center; margin: 1.4em 0; }
hr::after { content: "* * *"; letter-spacing: 0.5em; }
img { display: block; margin: 1em auto; max-width: 100%; max-height: 95vh; }
p > img:only-child { margin: 0 auto; }
blockquote { margin: 1em 1.5em; font-style: italic; }
.cover { margin: 0; padding: 0; text-align: center; }
.cover img { margin: 0 auto; max-height: 100vh; }
.title { text-align: center; }
.title h1 { font-size: 1.8em; margin-top: 3em; }
.title .volume { font-size: 1.2em; margin-bottom: 2em; }
.title .small { font-size: 0.85em; text-align: center; }
.note { font-size: 0.85em; text-align: left; margin-top: 2em; }
`;

export async function buildEpub(input: EpubInput): Promise<Buffer> {
  const { novel, cover, volume, chapters, siteUrl } = input;
  const heading = volumeHeading(volume);
  const fullTitle = `${novel.title} — ${heading}`;
  const identifier = `urn:saint-eresia:${novel.slug}:${volume.number}:${epubKey(input)}`;
  const shared = chapters.length > 0 && chapters.every((c) => c.translators === chapters[0].translators) ? chapters[0].translators : "";

  // Images : chaque adresse distincte devient un fichier images/img-NNN.jpg.
  const images = new Map<string, string>();
  const imagePath = (src: string) => {
    if (!images.has(src)) images.set(src, `images/img-${String(images.size + 1).padStart(3, "0")}.jpg`);
    return images.get(src)!;
  };

  const chapterFiles = chapters.map((chapter, index) => {
    const title = chapterHeading(chapter);
    const credit = chapter.translators && !shared ? `<p class="credit">Traduction : ${escape(chapter.translators)}</p>` : "";
    return {
      file: `chap-${String(index + 1).padStart(3, "0")}.xhtml`,
      title,
      xhtml: page(title, `<h1>${escape(title)}</h1>\n${credit}\n${toXhtml(chapter.content, imagePath)}`),
    };
  });

  const credits = [
    novel.author && `Texte : ${escape(novel.author)}`,
    novel.artist && `Illustrations : ${escape(novel.artist)}`,
    shared && `Traduction : ${escape(shared)}`,
  ].filter(Boolean);
  const titlePage = page(
    fullTitle,
    `<div class="title">
<h1>${escape(novel.title)}</h1>
<p class="volume">${escape(heading)}</p>
${novel.originalTitle ? `<p class="small">${escape(novel.originalTitle)}</p>` : ""}
${credits.map((line) => `<p class="small">${line}</p>`).join("\n")}
<p class="small">Traduction amateur française publiée par Saint Eresia<br/><a href="${escapeAttr(siteUrl)}/novels/${escapeAttr(novel.slug)}">${escape(siteUrl.replace(/^https?:\/\//, ""))}</a></p>
${volume.note ? `<div class="note">${toXhtml(volume.note, imagePath)}</div>` : ""}
</div>`,
  );

  const coverEntry = cover ? await toJpeg(await readImage(cover.file.startsWith("http") ? cover.file : `/uploads/${cover.file}`), 2400) : null;
  // Téléchargement des illustrations, quelques-unes à la fois.
  const files: ZipEntry[] = [];
  const queue = [...images.entries()];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let item = queue.shift(); item; item = queue.shift()) {
        const [src, name] = item;
        files.push({ name: `OEBPS/${name}`, data: await toJpeg(await readImage(src), 2000) });
      }
    }),
  );
  files.sort((a, b) => a.name.localeCompare(b.name));

  const nav = page(
    "Table des matières",
    `<nav epub:type="toc" id="toc"><h1>Table des matières</h1><ol>
<li><a href="title.xhtml">${escape(heading)}</a></li>
${chapterFiles.map((c) => `<li><a href="${c.file}">${escape(c.title)}</a></li>`).join("\n")}
</ol></nav>`,
  );
  const ncx = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${escapeAttr(identifier)}"/></head>
<docTitle><text>${escape(fullTitle)}</text></docTitle><navMap>
${[{ file: "title.xhtml", title: heading }, ...chapterFiles]
  .map((c, i) => `<navPoint id="n${i + 1}" playOrder="${i + 1}"><navLabel><text>${escape(c.title)}</text></navLabel><content src="${c.file}"/></navPoint>`)
  .join("\n")}
</navMap></ncx>`;

  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="fr">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">${escape(identifier)}</dc:identifier>
<dc:title>${escape(fullTitle)}</dc:title>
<dc:language>fr</dc:language>
${novel.author ? `<dc:creator>${escape(novel.author)}</dc:creator>` : ""}
<dc:publisher>Saint Eresia</dc:publisher>
<meta property="dcterms:modified">${modified}</meta>
${coverEntry ? `<meta name="cover" content="cover-image"/>` : ""}
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
<item id="style" href="style.css" media-type="text/css"/>
${coverEntry ? `<item id="cover-image" href="images/cover.jpg" media-type="image/jpeg" properties="cover-image"/>\n<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>` : ""}
<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>
${chapterFiles.map((c, i) => `<item id="c${i + 1}" href="${c.file}" media-type="application/xhtml+xml"/>`).join("\n")}
${files.map((f, i) => `<item id="i${i + 1}" href="${f.name.slice("OEBPS/".length)}" media-type="image/jpeg"/>`).join("\n")}
</manifest>
<spine toc="ncx">
${coverEntry ? `<itemref idref="cover" linear="yes"/>` : ""}
<itemref idref="title"/>
<itemref idref="nav" linear="no"/>
${chapterFiles.map((_, i) => `<itemref idref="c${i + 1}"/>`).join("\n")}
</spine>
</package>`;

  return zip([
    { name: "mimetype", data: "application/epub+zip" },
    {
      name: "META-INF/container.xml",
      data: `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
    },
    { name: "OEBPS/content.opf", data: opf },
    { name: "OEBPS/toc.ncx", data: ncx },
    { name: "OEBPS/nav.xhtml", data: nav },
    { name: "OEBPS/style.css", data: STYLE },
    ...(coverEntry
      ? [
          { name: "OEBPS/images/cover.jpg", data: coverEntry },
          { name: "OEBPS/cover.xhtml", data: page("Couverture", `<div class="cover"><img src="images/cover.jpg" alt="Couverture"/></div>`, "cover") },
        ]
      : []),
    { name: "OEBPS/title.xhtml", data: titlePage },
    ...chapterFiles.map((c) => ({ name: `OEBPS/${c.file}`, data: c.xhtml })),
    ...files,
  ]);
}
