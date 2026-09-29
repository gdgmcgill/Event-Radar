import type { ReactNode } from "react";
import { parseMarkdown, type MdBlock, type MdInline } from "./parse";

/** Renders the narrow Markdown grammar to React elements only. There is no
 * `dangerouslySetInnerHTML` anywhere in this module — every node the parser
 * can produce becomes a specific, known element, so there is nothing here
 * for an author's body text to inject into. Pure server-renderable: no
 * `"use client"`, no browser APIs. */

function renderInline(nodes: MdInline[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case "text":
        return node.value;
      case "strong":
        return <strong key={key}>{renderInline(node.children, key)}</strong>;
      case "em":
        return <em key={key}>{renderInline(node.children, key)}</em>;
      case "code":
        return <code key={key}>{node.value}</code>;
      case "link":
        return (
          <a key={key} href={node.href} target="_blank" rel="noopener noreferrer nofollow">
            {renderInline(node.children, key)}
          </a>
        );
    }
  });
}

function renderBlock(block: MdBlock, index: number): ReactNode {
  const key = `b-${index}`;
  switch (block.type) {
    case "heading": {
      const level = Math.min(block.level + 1, 4) as 2 | 3 | 4;
      const Heading = `h${level}` as "h2" | "h3" | "h4";
      return <Heading key={key}>{renderInline(block.children, key)}</Heading>;
    }
    case "paragraph":
      return <p key={key}>{renderInline(block.children, key)}</p>;
    case "list": {
      const items = block.items.map((item, itemIndex) => (
        <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
      ));
      return block.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
    }
    case "blockquote":
      return <blockquote key={key}>{renderInline(block.children, key)}</blockquote>;
    case "code":
      return (
        <pre key={key}>
          <code>{block.value}</code>
        </pre>
      );
  }
}

export function SafeMarkdown({ source }: { source: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none">
      {blocks.map((block, index) => renderBlock(block, index))}
    </div>
  );
}
