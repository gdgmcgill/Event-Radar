# Testing Patterns

**Analysis Date:** 2026-02-25

## Test Framework

**Runner:**
- Vitest 4.0.18 - Modern test runner with Vue/React support
- Config: `vitest.config.ts` in project root
- Setup file: `vitest.setup.ts` (imports `@testing-library/jest-dom/vitest`)

**Assertion Library:**
- Vitest built-in matchers (expect API)
- `@testing-library/jest-dom` for DOM matchers (e.g., `toBeInTheDocument()`)

**Run Commands:**
```bash
npm run test        # Run tests in watch mode
npm run test:run    # Run tests once and exit
```

**Environment:**
- `jsdom` - JavaScript implementation of web standards for DOM testing
- Test globals enabled (`globals: true` in config)
- React 18 with `@vitejs/plugin-react` for JSX support

## Test File Organization

**Location:**
- Co-located with source files using `.test.ts` or `.test.tsx` suffix
- Some utility tests also live alongside implementation (e.g., `kmeans.test.ts` beside `kmeans.ts`)
- Larger test suites can be in `src/__tests__/` directory

**Naming:**
- Match source filename exactly with `.test.*` addition
- Examples:
  - `useEvents.ts` → `useEvents.test.ts`
  - `EventFilters.tsx` → `EventFilters.test.tsx`
  - `classifier.ts` → `classifier.test.ts`

**File Structure Example:**
```
src/
├── hooks/
│   ├── useEvents.ts
│   └── useEvents.test.ts
├── components/
│   ├── events/
│   │   ├── EventCard.tsx
│   │   └── EventFilters.test.tsx
└── lib/
    ├── classifier.ts
    └── classifier.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
describe("ComponentName or FunctionName", () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
    cleanup();
    vi.clearAllMocks();
  });

  describe("Feature or Method Name", () => {
    it("should describe the behavior", () => {
      // Arrange
      const input = "value";

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe("expected");
    });
  });
});
```

**Patterns from codebase:**

```typescript
// From src/hooks/useEvents.test.ts - Hook testing
describe("useEvents Hook", () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial Fetch", () => {
    it("should fetch events on mount", async () => {
      const events = [createMockEvent("1"), createMockEvent("2")];
      mockFetch.mockResolvedValueOnce(mockApiResponse(events, 2));

      const { result } = renderHook(() => useEvents());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.events).toEqual(events);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
```

```typescript
// From src/components/ErrorBoundary.test.tsx - Component testing
describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the default fallback when a child throws", () => {
    render(
      <ErrorBoundary fallbackMessage="Calendar failed">
        <Thrower />
      </ErrorBoundary>
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Calendar failed")).toBeInTheDocument();
  });
});
```

## Mocking

**Framework:** Vitest's `vi` object (vi.mock, vi.fn, vi.spyOn)

**Global Mocks:**
```typescript
// Mock fetch globally (from useEvents.test.ts)
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Supabase client (from events/route.test.ts)
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/tagMapping", () => ({
  transformEventFromDB: (event: unknown) => event,
}));
```

**Function Mocks:**
```typescript
// Mock implementation with resolved value
mockFetch.mockResolvedValueOnce({
  ok: true,
  json: async () => ({ events: [...], total: 10 }),
});

// Mock implementation with rejection
mockFetch.mockRejectedValueOnce(new Error("Network error"));

// Mock with custom implementation
mockFetch.mockImplementationOnce(() => loadMorePromise);

// Spy on console methods
vi.spyOn(console, "error").mockImplementation(() => {});
```

**Patterns:**
- Mocks cleared in `beforeEach` or `afterEach` to isolate tests
- `vi.clearAllMocks()` in `afterEach()` to reset all mocks
- `vi.restoreAllMocks()` when spying on built-ins (console, etc.)

**What to Mock:**
- External API calls (fetch requests)
- Supabase clients and queries
- Utility functions that make side effects
- Console methods (to suppress logs during tests)
- Browser APIs like sessionStorage

**What NOT to Mock:**
- Pure utility functions (date formatting, validators)
- React hooks from React library
- Internal component logic (let components render naturally)
- Type definitions and constants

## Fixtures and Factories

**Test Data Creation:**
```typescript
// Factory function (from useEvents.test.ts)
const createMockEvent = (id: string, date: string = "2026-02-25"): Event => ({
  id,
  title: `Event ${id}`,
  description: `Description for event ${id}`,
  event_date: date,
  event_time: "18:00",
  start_date: new Date(date).toISOString(),
  end_date: new Date(date).toISOString(),
  location: "Test Location",
  club_id: "club-1",
  tags: ["Academic"],
  image_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  status: "approved",
  club: {
    id: "club-1",
    name: "Test Club",
    instagram_handle: "@testclub",
    logo_url: null,
    description: "Test club description",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
});

// API response factory
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

**Location:**
- Factory functions defined at top of test file
- Reusable across multiple tests in same file
- Allows easy customization with `overrides` parameter

```typescript
// Example with overrides (from classifier.test.ts)
function makePost(overrides: Partial<InstagramPost> = {}): InstagramPost {
  return {
    id: "test-post-1",
    caption: "",
    timestamp: "2026-02-20T12:00:00Z",
    image_url: "https://example.com/image.jpg",
    account: "mcgill_sus",
    ...overrides,
  };
}
```

## Coverage

**Requirements:** Not enforced (no coverage threshold specified in config)

**View Coverage:** Run tests with coverage flag (if configured)
```bash
npm run test:run -- --coverage
```

**Exclusions (from vitest.config.ts):**
- Supabase functions directory excluded
- `kmeans.test.ts` explicitly excluded (likely GPU/heavy computation test)

## Test Types

**Unit Tests:**
- Scope: Individual functions, hooks, utilities
- Approach: Test function inputs and outputs
- Examples: `utils.ts` (formatDate, formatTime, isMcGillEmail), pure functions

**Integration Tests:**
- Scope: Multiple components working together, API routes with mocked DB
- Approach: Test data flow through system
- Examples:
  - `useEvents.test.ts` - Hook with mocked fetch, pagination, filtering
  - `events/route.test.ts` - GET endpoint with mocked Supabase client
  - Component integration tests (ErrorBoundary with child components)

**E2E Tests:**
- Framework: Not used in current setup
- Approach: Would test complete user flows end-to-end

## Common Patterns

**Async Testing (from useEvents.test.ts):**
```typescript
// For hooks that fetch data
const { result } = renderHook(() => useEvents());

expect(result.current.loading).toBe(true);

await waitFor(() => {
  expect(result.current.loading).toBe(false);
});

expect(result.current.events).toEqual(events);
```

```typescript
// For async actions within components
const user = userEvent.setup();
await user.click(screen.getByRole("button", { name: "Reset" }));
expect(screen.getByText("Recovered content")).toBeInTheDocument();
```

```typescript
// For promise-based API calls
await act(async () => {
  await result.current.loadAll();
});

await waitFor(() => {
  expect(result.current.loading).toBe(false);
});
```

**Error Testing (from useEvents.test.ts):**
```typescript
// Test error state
it("should handle fetch errors", async () => {
  mockFetch.mockRejectedValueOnce(new Error("Network error"));

  const { result } = renderHook(() => useEvents());

  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });

  expect(result.current.error).toBeInstanceOf(Error);
  expect(result.current.error?.message).toBe("Network error");
  expect(result.current.events).toEqual([]);
});
```

**Component Render Testing (from EventFilters.test.tsx):**
```typescript
// Test rendering with props
it("initializes with provided initialTags", () => {
  const initialTags = [EVENT_TAGS[0], EVENT_TAGS[1]];
  render(<EventFilters initialTags={initialTags} />);

  expect(
    screen.getByRole("button", { name: /clear all filters/i })
  ).toBeInTheDocument();
});
```

**User Interaction Testing (from EventFilters.test.tsx):**
```typescript
// Test click handlers and state changes
it("calls onFilterChange when a category is toggled on", async () => {
  const user = userEvent.setup();
  const handleFilterChange = vi.fn();

  render(<EventFilters onFilterChange={handleFilterChange} />);

  const targetTag = EVENT_TAGS[0];
  const categoryLabel = EVENT_CATEGORIES[targetTag].label;

  const button = screen.getByRole("button", { name: categoryLabel });
  await user.click(button);

  expect(handleFilterChange).toHaveBeenCalledWith({
    tags: [targetTag],
  });
});
```

**API Route Testing (from events/route.test.ts):**
```typescript
// Test Next.js API route handlers
const request = new NextRequest("http://localhost/api/events?limit=2");
const response = await GET(request);
const body = await response.json();

expect(response.status).toBe(200);
expect(body.events).toHaveLength(2);
expect(body.prevCursor).toBeNull();
expect(body.nextCursor).toBeTruthy();
```

## Testing Best Practices

**Isolation:**
- Clear all mocks between tests
- Use `cleanup()` from testing-library to clean up DOM
- Reset refs and state for each test

**Naming:**
- Test description starts with "should" for clarity
- Use `describe()` to group related tests
- Nested describe blocks for logical organization

**Async Handling:**
- Use `waitFor()` for assertions that depend on async state updates
- Use `act()` wrapper when directly updating hook state in tests
- Proper timeouts for long-running operations

**Assertions:**
- One primary assertion per test (though multiple related assertions OK)
- Use specific matchers (`toEqual` not `toBe` for objects)
- Check important properties, not implementation details

---

*Testing analysis: 2026-02-25*
