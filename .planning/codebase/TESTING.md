# Testing Patterns

**Analysis Date:** 2026-02-23

## Test Framework

**Runner:**
- Vitest 4.0.18
- Config: `vitest.config.ts`

**Assertion Library:**
- `@testing-library/jest-dom` (provides custom matchers like `toBeInTheDocument()`)

**Environment:**
- jsdom (browser-like environment for component tests)

**Run Commands:**
```bash
npm test              # Run all tests in watch mode
npm run test:run      # Run all tests once and exit
```

## Test File Organization

**Location:**
- Tests co-located with source files (same directory as the code being tested)
- Pattern: `ComponentName.test.tsx` or `functionName.test.ts`

**Naming:**
- `.test.ts` for utility functions and hooks
- `.test.tsx` for React components
- Excluded from TypeScript compilation by `tsconfig.json`

**Structure:**
Tests excluded from main tsconfig but included in vitest:
- Main config excludes: `"**/*.test.ts"` and `"**/*.test.tsx"`
- Vitest includes: `src/**/*.test.{ts,tsx}` (from `vitest.config.ts`)
- Special case: `src/lib/kmeans.test.ts` is explicitly excluded from vitest
- Special case: `supabase/functions/tests/webhook.test.ts` handled separately

## Test Structure

**Suite Organization:**

Tests use `describe()` blocks for grouping related tests:

```typescript
describe("EventFilters Component", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders all available categories", () => {
    // test implementation
  });

  it("calls onFilterChange when a category is toggled", async () => {
    // test implementation
  });
});
```

Nested describe blocks for organizing by feature or behavior (from `src/hooks/useEvents.test.ts`):

```typescript
describe("useEvents Hook", () => {
  describe("Initial Fetch", () => {
    it("should fetch events on mount", async () => { ... });
  });

  describe("Cursor-Based Pagination", () => {
    it("should fetch with nextCursor when goToNext is called", async () => { ... });
  });

  describe("Load More Functionality", () => {
    it("should append events when loadMore is called", async () => { ... });
  });
});
```

**Setup/Teardown:**

- `beforeEach()`: Setup before each test (clear mocks, reset state)
- `afterEach()`: Cleanup after each test (`cleanup()` for React Testing Library, `vi.clearAllMocks()` for vitest)
- Example from `src/components/events/EventFilters.test.tsx`:
  ```typescript
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });
  ```

**Assertion Patterns:**

- Use Testing Library queries: `screen.getByRole()`, `screen.getByText()`
- Use specific matchers: `toBeInTheDocument()`, `toHaveBeenCalledWith()`, `toHaveBeenCalledTimes()`
- Example:
  ```typescript
  expect(res.status).toBe(404);
  expect(json.error).toBe("Event not found");
  expect(mockFetch).toHaveBeenCalledTimes(1);
  ```

## Mocking

**Framework:** Vitest's `vi` object for mocking

**Mocking Patterns:**

Global fetch mock (from `src/hooks/useEvents.test.ts`):
```typescript
const mockFetch = vi.fn();
global.fetch = mockFetch;
```

Module mocks (from `src/__tests__/api/events/rsvp.test.ts`):
```typescript
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));
```

Function mocks:
```typescript
const handleFilterChange = vi.fn();
render(<EventFilters onFilterChange={handleFilterChange} />);
expect(handleFilterChange).toHaveBeenCalledWith({ tags: [...] });
```

**Mock Query Builders (Chainable Supabase):**

From `src/__tests__/api/events/rsvp.test.ts`:
```typescript
function createMockQueryBuilder(resolvedValue: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const methods = ["select", "insert", "update", "delete", "eq", "neq", "maybeSingle", "single"];
  for (const method of methods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.from = vi.fn().mockReturnValue(builder);
  builder.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  builder.single = vi.fn().mockResolvedValue(resolvedValue);
  return builder;
}
```

**Mocking Responses:**

Helper for mocking API responses (from `src/hooks/useEvents.test.ts`):
```typescript
const mockApiResponse = (
  events: Event[],
  total: number,
  nextCursor: string | null = null,
  prevCursor: string | null = null
) => ({
  ok: true,
  json: async () => ({
    events,
    total,
    nextCursor,
    prevCursor,
  }),
});
```

**What to Mock:**
- External API calls (fetch, Supabase client)
- Database operations
- Date/time if needed for deterministic tests
- console methods (when testing error scenarios)

**What NOT to Mock:**
- React Testing Library components or hooks (let them run naturally)
- User interaction utilities (userEvent is not mocked)
- Internal utility functions within the module being tested

## Fixtures and Factories

**Test Data:**

Consistent factory function pattern:
```typescript
const createMockEvent = (id: string, date: string = "2026-02-25"): Event => ({
  id,
  title: `Event ${id}`,
  description: `Description for event ${id}`,
  event_date: date,
  event_time: "18:00",
  // ... other fields
});
```

Mock request helpers:
```typescript
function createMockRequest(method: string, body?: Record<string, unknown>): Request {
  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  return new Request("http://localhost:3000/api/events/test-event-id/rsvp", init);
}
```

**Location:**
- Factories and helpers defined at the top of test files
- Shared test utilities co-located with test file
- Mock data initialized in `beforeEach()` blocks when mutable

## Coverage

**Requirements:** Not enforced by tooling

**View Coverage:**
```bash
npm test -- --coverage
```

## Test Types

**Unit Tests:**
- Test single functions in isolation
- Examples: `src/lib/utils.ts` utilities, component rendering
- Scope: Single function or component behavior
- Setup with mocked dependencies

**Integration Tests:**
- Test multiple components/functions working together
- Examples: Hook tests in `src/hooks/useEvents.test.ts` testing fetch + pagination + filtering
- Scope: Multiple layers (API + state management)

**E2E Tests:**
- Not used in this codebase

## Common Patterns

**Async Testing:**

Using `waitFor()` with timeouts for async state updates:
```typescript
await waitFor(() => {
  expect(result.current.loading).toBe(false);
}, { timeout: 2000 });
```

Using `act()` to wrap state-changing operations:
```typescript
act(() => {
  result.current.goToNext();
});

await waitFor(() => {
  expect(result.current.events).toEqual(page2Events);
});
```

Async actions wrapped in `act()`:
```typescript
await act(async () => {
  await result.current.loadAll();
});
```

**Error Testing:**

Testing errors in API routes:
```typescript
it("returns 404 when event does not exist", async () => {
  mockQueryResults.set("events", { data: null, error: null });

  const req = createMockRequest("GET");
  const res = await GET(req, createRouteContext());
  const json = await res.json();

  expect(res.status).toBe(404);
  expect(json.error).toBe("Event not found");
});
```

Testing hook errors:
```typescript
it("should handle fetch errors", async () => {
  mockFetch.mockRejectedValueOnce(new Error("Network error"));

  const { result } = renderHook(() => useEvents());

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.error).toBeInstanceOf(Error);
  expect(result.current.error?.message).toBe("Network error");
});
```

**User Interaction Testing:**

Using `userEvent.setup()` for realistic interactions:
```typescript
const user = userEvent.setup();
const handleFilterChange = vi.fn();

render(<EventFilters onFilterChange={handleFilterChange} />);

const button = screen.getByRole("button", { name: categoryLabel });
await user.click(button);

expect(handleFilterChange).toHaveBeenCalledWith({ tags: [targetTag] });
```

**Testing Component Props:**

Rendering with different prop values:
```typescript
it("initializes with provided initialTags", () => {
  const initialTags = [EVENT_TAGS[0], EVENT_TAGS[1]];
  render(<EventFilters initialTags={initialTags} />);

  expect(screen.getByRole("button", { name: /clear all filters/i })).toBeInTheDocument();
});
```

**Testing Render Hooks:**

Setup and waiting for state changes:
```typescript
const { result } = renderHook(() => useEvents());

expect(result.current.loading).toBe(true);

await waitFor(() => {
  expect(result.current.loading).toBe(false);
});

expect(result.current.events).toEqual(events);
```

Rerendering with different props:
```typescript
const { result, rerender } = renderHook(
  ({ filters }) => useEvents({ filters }),
  {
    initialProps: { filters: { tags: ["Academic"] } },
  }
);

rerender({ filters: { tags: ["Social"] } });
```

---

*Testing analysis: 2026-02-23*
