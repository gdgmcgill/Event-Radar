/**
 * `EditorialAbout` (P1-06 fix round 1, finding 5): the hiring/"role to
 * share" call to action must link to `/for-companies`, not `/submit` — only
 * an opportunity submission belongs on `/submit`.
 */

import { render, screen } from "@testing-library/react";
import { EditorialAbout } from "./EditorialAbout";

describe("EditorialAbout", () => {
  it("links the opportunity submission clause to /submit and the hiring clause to /for-companies", () => {
    render(<EditorialAbout />);
    expect(screen.getByText("Submit it here")).toHaveAttribute("href", "/submit");
    expect(screen.getByText("Tell us about it")).toHaveAttribute(
      "href",
      "/for-companies"
    );
  });
});
