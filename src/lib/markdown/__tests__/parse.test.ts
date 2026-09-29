import { parseMarkdown, findUnsafeMarkdown, isSafeHref } from "../parse";

describe("safe markdown", () => {
  it("parses headings, paragraphs and lists", () => {
    expect(parseMarkdown("# Title\n\nHello **world**\n\n- a\n- b")).toEqual([
      { type: "heading", level: 1, children: [{ type: "text", value: "Title" }] },
      {
        type: "paragraph",
        children: [
          { type: "text", value: "Hello " },
          { type: "strong", children: [{ type: "text", value: "world" }] },
        ],
      },
      {
        type: "list",
        ordered: false,
        items: [[{ type: "text", value: "a" }], [{ type: "text", value: "b" }]],
      },
    ]);
  });

  it("keeps only http(s)/mailto links", () => {
    expect(isSafeHref("https://example.org")).toBe(true);
    expect(isSafeHref("mailto:a@b.co")).toBe(true);
    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:x",
      "data:text/html,x",
      "vbscript:x",
      "//evil.test",
      "/relative",
    ]) {
      expect(isSafeHref(bad)).toBe(false);
    }
    expect(parseMarkdown("[x](javascript:alert(1))")[0]).toEqual({
      type: "paragraph",
      children: [{ type: "text", value: "[x](javascript:alert(1))" }],
    });
  });

  it("rejects raw HTML and unsafe links at validation", () => {
    expect(findUnsafeMarkdown("<script>alert(1)</script>")).toMatch(/HTML/);
    expect(findUnsafeMarkdown("<img src=x onerror=alert(1)>")).toMatch(/HTML/);
    expect(findUnsafeMarkdown("[x](data:text/html;base64,AAA)")).toMatch(/link/);
    expect(findUnsafeMarkdown("Plain 3 < 5 and a [link](https://ok.test)")).toBeNull();
  });
});
