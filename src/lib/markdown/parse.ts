/** A tiny, deliberately narrow Markdown grammar (M3 P1-08).
 *
 * This is not a general Markdown implementation: it supports exactly the
 * subset authored resources need (headings, paragraphs, lists, blockquotes,
 * fenced code, and inline strong/em/code/link), and it never emits raw HTML.
 * `SafeMarkdown.tsx` renders the resulting tree with React elements only —
 * never `dangerouslySetInnerHTML` — so there is no HTML string to sanitize
 * in the first place. `findUnsafeMarkdown` is the pre-save gate: it refuses
 * raw HTML tags and any link whose target is not http(s) or mailto.
 */

export type MdInline =
  | { type: "text"; value: string }
  | { type: "strong"; children: MdInline[] }
  | { type: "em"; children: MdInline[] }
  | { type: "code"; value: string }
  | { type: "link"; href: string; children: MdInline[] };

export type MdBlock =
  | { type: "heading"; level: number; children: MdInline[] }
  | { type: "paragraph"; children: MdInline[] }
  | { type: "list"; ordered: boolean; items: MdInline[][] }
  | { type: "blockquote"; children: MdInline[] }
  | { type: "code"; value: string };

/** Only http(s) and mailto targets are ever rendered as a link. */
export function isSafeHref(href: string): boolean {
  return /^(https?:\/\/[^\s]+|mailto:[^\s@]+@[^\s@]+)$/i.test(href);
}

const CODE_RE = /^`([^`]+)`/;
const STRONG_RE = /^\*\*([^*]+)\*\*/;
const EM_RE = /^(\*([^*]+)\*|_([^_]+)_)/;
const LINK_RE = /^\[([^\]]*)\]\(([^)\s]*)\)/;

/** Scans inline text left to right. An unsafe link never becomes a link
 * node: its whole `[text](href)` source stays as literal text instead. */
export function parseInline(source: string): MdInline[] {
  const nodes: MdInline[] = [];
  let buffer = "";
  let i = 0;
  const flush = () => {
    if (buffer) {
      nodes.push({ type: "text", value: buffer });
      buffer = "";
    }
  };
  while (i < source.length) {
    const rest = source.slice(i);
    const code = CODE_RE.exec(rest);
    if (code) {
      flush();
      nodes.push({ type: "code", value: code[1] });
      i += code[0].length;
      continue;
    }
    const strong = STRONG_RE.exec(rest);
    if (strong) {
      flush();
      nodes.push({ type: "strong", children: parseInline(strong[1]) });
      i += strong[0].length;
      continue;
    }
    const em = EM_RE.exec(rest);
    if (em) {
      flush();
      nodes.push({ type: "em", children: parseInline(em[2] ?? em[3] ?? "") });
      i += em[0].length;
      continue;
    }
    const link = LINK_RE.exec(rest);
    if (link) {
      const [whole, text, href] = link;
      if (isSafeHref(href)) {
        flush();
        nodes.push({ type: "link", href, children: parseInline(text) });
      } else {
        // Unsafe target: keep the raw source as literal text, merged with
        // whatever text surrounds it.
        buffer += whole;
      }
      i += whole.length;
      continue;
    }
    buffer += rest[0];
    i += 1;
  }
  flush();
  return nodes;
}

const FENCE_RE = /^```/;
const HEADING_RE = /^(#{1,3})\s+(.*)$/;
const QUOTE_RE = /^>\s?(.*)$/;
const UL_RE = /^[-*]\s+(.*)$/;
const OL_RE = /^\d+\.\s+(.*)$/;

/** Line-based block grammar. Blank lines separate blocks; a paragraph joins
 * its lines with a single space (soft line breaks). */
export function parseMarkdown(source: string): MdBlock[] {
  const lines = source.split(/\r\n|\n/);
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    if (FENCE_RE.test(line)) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE_RE.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // consume the closing fence, if present
      blocks.push({ type: "code", value: body.join("\n") });
      continue;
    }
    const heading = HEADING_RE.exec(line);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, children: parseInline(heading[2].trim()) });
      i += 1;
      continue;
    }
    if (QUOTE_RE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        body.push(QUOTE_RE.exec(lines[i])![1]);
        i += 1;
      }
      blocks.push({ type: "blockquote", children: parseInline(body.join(" ").trim()) });
      continue;
    }
    const isOrdered = OL_RE.test(line);
    const isUnordered = UL_RE.test(line);
    if (isOrdered || isUnordered) {
      const itemRe = isOrdered ? OL_RE : UL_RE;
      const items: MdInline[][] = [];
      while (i < lines.length && itemRe.test(lines[i])) {
        items.push(parseInline(itemRe.exec(lines[i])![1]));
        i += 1;
      }
      blocks.push({ type: "list", ordered: isOrdered, items });
      continue;
    }
    const body: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !FENCE_RE.test(lines[i]) &&
      !HEADING_RE.test(lines[i]) &&
      !QUOTE_RE.test(lines[i]) &&
      !UL_RE.test(lines[i]) &&
      !OL_RE.test(lines[i])
    ) {
      body.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: "paragraph", children: parseInline(body.join(" ")) });
  }
  return blocks;
}

const HTML_TAG_RE = /<\/?[a-z][^>]*>/i;
const LINK_TARGET_RE = /\]\(([^)\s]+)\)/g;

/** Validation gate for saved bodies: a reason string, or null when safe. */
export function findUnsafeMarkdown(source: string): string | null {
  if (HTML_TAG_RE.test(source)) return "Raw HTML is not allowed";
  LINK_TARGET_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = LINK_TARGET_RE.exec(source))) {
    if (!isSafeHref(match[1])) return "Only https, http and mailto links are allowed";
  }
  return null;
}
