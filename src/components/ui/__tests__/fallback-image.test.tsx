/**
 * `FallbackImage` (Task 6): a stale external image URL (e.g. an expired
 * Instagram media URL) must render the placeholder, and a broken fallback
 * must never loop `onError` forever. `next/image` is mocked to a plain
 * passthrough `<img>` so `fireEvent.error` can be dispatched directly.
 */

import type { ImgHTMLAttributes } from "react";
import { fireEvent, render } from "@testing-library/react";
import { FallbackImage } from "../FallbackImage";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    fill,
    priority,
    unoptimized,
    alt,
    ...rest
  }: Record<string, unknown>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt as string}
      {...(rest as ImgHTMLAttributes<HTMLImageElement>)}
    />
  ),
}));

describe("FallbackImage", () => {
  it("swaps to the fallback once on error and does not loop on a second error", () => {
    const { getByAltText } = render(
      <FallbackImage
        src="https://example.com/expired.jpg"
        alt="Event"
        fallbackSrc="/placeholder-event.png"
      />
    );
    const img = getByAltText("Event") as HTMLImageElement;
    expect(img.src).toContain("expired.jpg");

    fireEvent.error(img);
    expect(img.src.endsWith("/placeholder-event.png")).toBe(true);

    fireEvent.error(img);
    expect(img.src.endsWith("/placeholder-event.png")).toBe(true);
  });

  it("renders the default fallback for an empty src", () => {
    const { getByAltText } = render(<FallbackImage src="" alt="Empty" />);
    const img = getByAltText("Empty") as HTMLImageElement;
    expect(img.src.endsWith("/placeholder-event.png")).toBe(true);
  });

  it("uses a custom fallbackSrc when given", () => {
    const { getByAltText } = render(
      <FallbackImage src="" alt="Custom" fallbackSrc="/custom-fallback.png" />
    );
    const img = getByAltText("Custom") as HTMLImageElement;
    expect(img.src.endsWith("/custom-fallback.png")).toBe(true);
  });
});
