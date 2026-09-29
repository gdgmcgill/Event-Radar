import { render } from "@testing-library/react";
import { SafeMarkdown } from "../SafeMarkdown";

describe("SafeMarkdown", () => {
  it("never renders raw HTML and only ever emits safe anchors", () => {
    const { container } = render(
      <SafeMarkdown source={"<b>x</b> [a](https://a.test)"} />
    );
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<b>x</b>");
    const anchor = container.querySelector("a");
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer nofollow");
    expect(anchor?.getAttribute("target")).toBe("_blank");
  });
});
