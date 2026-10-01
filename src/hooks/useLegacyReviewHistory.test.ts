import useSWR from "swr";
import { useEventReviews } from "./useAnalytics";
jest.mock("swr", () => ({ __esModule: true, default: jest.fn(() => ({})) }));

it("does not fetch private history for an anonymous viewer", () => {
  useEventReviews("event-1");
  expect(useSWR).toHaveBeenLastCalledWith(null, expect.any(Function));
});

it("uses separate private cache keys when accounts switch", () => {
  useEventReviews("event-1", "author-1");
  expect(useSWR).toHaveBeenLastCalledWith(["/api/events/event-1/reviews", "author-1"], expect.any(Function));
  useEventReviews("event-1", "author-2");
  expect(useSWR).toHaveBeenLastCalledWith(["/api/events/event-1/reviews", "author-2"], expect.any(Function));
});
