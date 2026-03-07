import { sanitizeText } from "./sanitize";

describe("sanitizeText", () => {
  it("strips <script> tags from input", () => {
    const input = `<script>alert('xss')</script>`;
    const result = sanitizeText(input);
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("alert");
    expect(result).toBe("");
  });

  it("removes <img> with onerror attribute", () => {
    const input = `<img onerror="alert('xss')">`;
    const result = sanitizeText(input);
    expect(result).not.toContain("<img");
    expect(result).not.toContain("onerror");
    expect(result).toBe("");
  });

  it("preserves plain text", () => {
    const input = "McGill Fall Fest 2026";
    expect(sanitizeText(input)).toBe("McGill Fall Fest 2026");
  });

  it("strips HTML but keeps inner text content", () => {
    const input = "<b>Bold</b> and <i>italic</i>";
    expect(sanitizeText(input)).toBe("Bold and italic");
  });
});
