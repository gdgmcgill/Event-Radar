/** M2: delayed private reads cannot undo writes or survive an account change. */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DiscoveryItem } from "@/contracts/discovery";
import { DiscoveryClient } from "./DiscoveryClient";
import { OpportunityDetail } from "./OpportunityDetail";
let mockUser: { id: string } | null;
const mockRequest = jest.fn();
jest.mock("@/store/useAuthStore", () => ({ useAuthStore: (select: (state: { user: typeof mockUser }) => unknown) => select({ user: mockUser }) }));
jest.mock("next/navigation", () => ({ useRouter: () => ({ replace: jest.fn() }), useSearchParams: () => new URLSearchParams() }));
jest.mock("@/components/auth/SignInButton", () => ({ SignInButton: () => <button>Sign in</button> }));
const item: DiscoveryItem = {
 id: "10000000-0000-4000-8000-000000000001",kind: "opportunity",title: "Private shortlist fixture",description: "Description",organization: "Organization",listing_type: "job",fields: [],deadline_precision: "none",source_timezone: "America/Toronto",work_mode: "remote",application_mode: "none",relevance_scope: "cross_campus",source_type: "manual",
 slug: null, subtype: null, organizer_university_id: null, location: "", university_ids: [], eligibility_text: null, source_url: null, action_url: null, action_note: null, starts_at: null, ends_at: null, deadline_at: null, deadline_date: null, timezone_assumed: true, review_at: null, checked_at: null, published_at: "2026-09-29T00:00:00Z", curator_note: null, pick_reason: null, is_pick: false, editorial_priority: 0, actionable_at: null, expires_at: null, closed: false, canonical_kind: null, canonical_id: null,
};
const other = { ...item,id: "10000000-0000-4000-8000-000000000002",title: "Second fixture" };
const page = (items = [item], next_cursor: string | null = null) => ({ items,next_cursor,as_of: "2026-09-29T00:00:00Z" });
const response = (body: unknown) => ({ ok: true,json: async () => body } as Response);
function deferred() {
 let resolve!: (value: Response) => void;
 const promise = new Promise<Response>(done => { resolve = done; });
 return { promise,resolve };
}
beforeEach(() => {
 mockUser = { id: "author" };
 mockRequest.mockReset();
 global.fetch = mockRequest;
});
function baseline(url: string) {
 if (url === "/api/universities") return Promise.resolve(response({ universities: [] }));
 if (url.startsWith("/api/discovery") || url.startsWith("/api/saved?")) return Promise.resolve(response(page()));
 throw new Error(`Unexpected fetch ${url}`);
}
it.each(["feed","detail"] as const)("%s: a delayed initial status cannot undo successful save", async surface => {
 const status = deferred();
 mockRequest.mockImplementation((url: string, init?: RequestInit) => {
  if (url.startsWith("/api/saved/status")) return status.promise;
  if (init?.method === "PUT") return Promise.resolve(response({ saved: true }));
  return baseline(url);
 });
 render(surface === "feed" ? <DiscoveryClient /> : <OpportunityDetail item={item} />);
 const save = await screen.findByRole("button", { name: surface === "feed" ? `Save ${item.title}` : "Save for later" });
 await waitFor(() => expect(mockRequest.mock.calls.some(([url]) => String(url).startsWith("/api/saved/status"))).toBe(true));
 fireEvent.click(save);
 await waitFor(() => expect(save).toHaveAttribute("aria-pressed", "true"));
 await act(async () => status.resolve(response({ saved: [] })));
 expect(save).toHaveAttribute("aria-pressed", "true");
});
it("feed: a delayed pagination status cannot restore a successfully unsaved item", async () => {
 const delayedStatus = deferred(); let reads = 0;
 mockRequest.mockImplementation((url: string, init?: RequestInit) => {
  if (url.startsWith("/api/saved/status")) return ++reads === 1 ? Promise.resolve(response({ saved: [item] })) : delayedStatus.promise;
  if (init?.method === "DELETE") return Promise.resolve(response({ saved: false }));
  if (url.startsWith("/api/discovery")) return Promise.resolve(response(url.includes("cursor=") ? page([other]) : page([item], "next")));
  return baseline(url);
 });
 render(<DiscoveryClient />);
 const unsave = await screen.findByRole("button", { name: `Unsave ${item.title}` });
 fireEvent.click(screen.getByRole("button", { name: "Load more" }));
 await screen.findByRole("heading", { name: other.title });
 await waitFor(() => expect(reads).toBe(2));
 fireEvent.click(unsave);
 await waitFor(() => expect(unsave).toHaveAttribute("aria-pressed", "false"));
 await act(async () => delayedStatus.resolve(response({ saved: [item] })));
 expect(unsave).toHaveAttribute("aria-pressed", "false");
});
it("feed: completing a different save does not unlock an in-flight identity", async () => {
 const first = deferred(), second = deferred();
 mockRequest.mockImplementation((url: string, init?: RequestInit) => {
  if (url.startsWith("/api/saved/status")) return Promise.resolve(response({ saved: [] }));
  if (init?.method === "PUT") return url.includes(item.id) ? first.promise : second.promise;
  if (url.startsWith("/api/discovery")) return Promise.resolve(response(page([item,other])));
  return baseline(url);
 });
 render(<DiscoveryClient />);
 const a = await screen.findByRole("button", { name: `Save ${item.title}` });
 const b = screen.getByRole("button", { name: `Save ${other.title}` });
 fireEvent.click(a); fireEvent.click(b);
 expect(a).toBeDisabled(); expect(b).toBeDisabled();
 await act(async () => second.resolve(response({ saved: true })));
 expect(a).toBeDisabled(); expect(b).toBeEnabled();
 fireEvent.click(a);
 expect(mockRequest.mock.calls.filter(([url,init]) => String(url).includes(item.id) && init?.method === "PUT")).toHaveLength(1);
 await act(async () => first.resolve(response({ saved: true })));
 expect(a).toBeEnabled();
});
it("saved feed clears private cards immediately on sign-out", async () => {
 mockRequest.mockImplementation((url: string) => baseline(url));
 const view = render(<DiscoveryClient savedOnly />);
 await screen.findByRole("heading", { name: item.title });
 mockUser = null;
 await act(async () => { view.rerender(<DiscoveryClient savedOnly />); });
 expect(screen.queryByRole("heading", { name: item.title })).not.toBeInTheDocument();
 expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
});
it("detail resets private save state on sign-out and a different account", async () => {
 let reads = 0;
 mockRequest.mockImplementation((url: string) => url.startsWith("/api/saved/status") ? Promise.resolve(response({ saved: ++reads === 1 ? [item] : [] })) : baseline(url));
 const view = render(<OpportunityDetail item={item} />);
 await screen.findByRole("button", { name: "Saved to your shortlist" });
 mockUser = null; await act(async () => { view.rerender(<OpportunityDetail item={item} />); });
 expect(screen.queryByRole("button", { name: "Saved to your shortlist" })).not.toBeInTheDocument();
 expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
 mockUser = { id: "other-author" }; await act(async () => { view.rerender(<OpportunityDetail item={item} />); });
 expect(screen.getByRole("button", { name: "Save for later" })).toHaveAttribute("aria-pressed", "false");
 await waitFor(() => expect(reads).toBe(2));
});

it("saved feed: stale retry snapshot cannot restore an unsave completed during reload", async () => {
 const unsave = deferred(), reload = deferred(); let reads = 0;
 mockRequest.mockImplementation((url: string, init?: RequestInit) => {
  if (init?.method === "DELETE") return unsave.promise;
  if (url.startsWith("/api/saved?")) {
   if (url.includes("cursor=")) return Promise.resolve({ ok: false,json: async () => ({ error: "Temporary page failure" }) } as Response);
   return ++reads === 1 ? Promise.resolve(response(page([item], "next"))) : reload.promise;
  }
  return baseline(url);
 });
 render(<DiscoveryClient savedOnly />);
 const remove = await screen.findByRole("button", { name: `Unsave ${item.title}` });
 fireEvent.click(screen.getByRole("button", { name: "Load more" }));
 await screen.findByRole("alert");
 fireEvent.click(remove);
 fireEvent.click(screen.getByRole("button", { name: "Try again" }));
 await waitFor(() => expect(reads).toBe(2));
 await act(async () => unsave.resolve(response({ saved: false })));
 await act(async () => reload.resolve(response(page([item]))));
 expect(screen.queryByRole("heading", { name: item.title })).not.toBeInTheDocument();
 expect(screen.getByRole("heading", { name: "Your shortlist is ready for its first find." })).toBeInTheDocument();
});

it("Saved refetches a previous screen's save that completes after navigation", async () => {
 const mutation = deferred(); let persisted = false;
 mockRequest.mockImplementation((url: string, init?: RequestInit) => {
  if (url.startsWith("/api/saved/status")) return Promise.resolve(response({ saved: [] }));
  if (init?.method === "PUT") return mutation.promise.then(result => { persisted = true; return result; });
  if (url.startsWith("/api/saved?")) return Promise.resolve(response(page(persisted ? [item] : [])));
  return baseline(url);
 });
 const view = render(<OpportunityDetail item={item} />);
 fireEvent.click(screen.getByRole("button", { name: "Save for later" }));
 view.rerender(<DiscoveryClient savedOnly />);
 await screen.findByRole("heading", { name: "Your shortlist is ready for its first find." });
 await act(async () => mutation.resolve(response({ saved: true })));
 await screen.findByRole("heading", { name: item.title });
 expect(mockRequest.mock.calls.filter(([url]) => String(url).startsWith("/api/saved?"))).toHaveLength(2);
});
it("a previous account's late save completion does not refetch the next account's Saved", async () => {
 const mutation = deferred();
 mockRequest.mockImplementation((url: string, init?: RequestInit) => {
  if (url.startsWith("/api/saved/status")) return Promise.resolve(response({ saved: [] }));
  if (init?.method === "PUT") return mutation.promise;
  if (url.startsWith("/api/saved?")) return Promise.resolve(response(page([])));
  return baseline(url);
 });
 const view = render(<OpportunityDetail item={item} />);
 fireEvent.click(screen.getByRole("button", { name: "Save for later" }));
 mockUser = { id: "different-account" };
 view.rerender(<DiscoveryClient savedOnly />);
 await screen.findByRole("heading", { name: "Your shortlist is ready for its first find." });
 await act(async () => mutation.resolve(response({ saved: true })));
 expect(screen.queryByRole("heading", { name: item.title })).not.toBeInTheDocument();
 expect(mockRequest.mock.calls.filter(([url]) => String(url).startsWith("/api/saved?"))).toHaveLength(1);
});
