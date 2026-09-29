/**
 * `productNavigation` (Task 7): the M3 nav only points at routes this
 * milestone actually delivers (or is delivering — `/submit` and
 * `/for-companies` are P1-09, on this same milestone). It must never carry a
 * link to a route from an undelivered milestone such as `/weekly`, `/talent`
 * or `/recruiting`.
 */

import { productNavigation, secondaryAction } from "../productNavigation";

const DELIVERED_PUBLIC_ROUTES = new Set([
  "/discover",
  "/resources",
  "/for-companies",
  "/clubs",
  "/about",
]);

const UNDELIVERED_ROUTE_PATTERNS = [/^\/weekly/, /^\/talent/, /^\/recruiting/];

describe("productNavigation", () => {
  it("only links public entries to delivered routes", () => {
    const publicLinks = productNavigation.filter(
      (item) => item.audience === "public"
    );
    expect(publicLinks.length).toBeGreaterThan(0);
    for (const item of publicLinks) {
      expect(DELIVERED_PUBLIC_ROUTES.has(item.href)).toBe(true);
    }
  });

  it("never links to an undelivered milestone's routes", () => {
    const hrefs = [
      ...productNavigation.map((item) => item.href),
      secondaryAction.href,
    ];
    for (const href of hrefs) {
      for (const pattern of UNDELIVERED_ROUTE_PATTERNS) {
        expect(pattern.test(href)).toBe(false);
      }
    }
  });

  it("exposes a Submit secondary action", () => {
    expect(secondaryAction).toEqual({ label: "Submit", href: "/submit" });
  });
});
