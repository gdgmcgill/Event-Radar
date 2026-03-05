# Testing Patterns

**Analysis Date:** 2026-03-05

## Test Framework

**Runner:**
- Vitest (bundled with project, no separate version pinned in package.json)
- Config: `vitest.config.ts`
- Environment: jsdom
- Globals: enabled (`describe`, `it`, `expect`, `vi` available without import, though files import them explicitly)
- Setup file: `vitest.setup.ts` (loads `@testing-library/jest-dom/vitest`)

**Assertion Library:**
- Vitest built-in `expect` (compatible with Jest API)
- `@testing-library/jest-dom/vitest` for DOM assertions (`toBeInTheDocument()`, `toHaveClass()`)

**Run Commands:**
```bash
npx vitest              # Run all tests (watch mode by default)
npx vitest run          # Run all tests once
npx vitest run --coverage  # Coverage (if configured)
```

Note: No `test` script is defined in `package.json`. Run vitest directly via npx.

## Test File Organization

**Location:**
- Mixed pattern: both co-located and centralized tests exist
- Co-located: test file next to source file (e.g., `src/lib/dateValidation.test.ts` next to `src/lib/dateValidation.ts`)
- Centralized: `src/__tests__/api/events/` for some API route tests
- API route co-located: `src/app/api/events/route.test.ts`, `src/app/api/events/export/route.test.ts`
- Component co-located: `src/components/ErrorBoundary.test.tsx`, `src/components/events/EventFilters.test.tsx`

**Naming:**
- `{filename}.test.ts` for TypeScript modules
- `{filename}.test.tsx` for React components
- No `.spec.` convention used

**Exclusions:**
- `vitest.config.ts` excludes: `supabase/**`, `src/lib/kmeans.test.ts`
- `tsconfig.json` excludes: `**/*.test.ts`, `**/*.test.tsx` from type-checking compilation

**Structure:**
```
src/
├── __tests__/
│   └── api/events/
│       ├── date-validation.test.ts
│       ├── get-events.test.ts
│       └── rsvp.test.ts
├── app/api/events/
│   ├── route.test.ts              # co-located with route.ts
│   └── export/route.test.ts       # co-located with route.ts
├── components/
│   ├── ErrorBoundary.test.tsx     # co-located
│   └── events/
│       ├── EventFilters.test.tsx  # co-located
│       └── FilterSidebar.test.tsx # co-located
├── hooks/
│   └── useEvents.test.ts         # co-located
└── lib/
    ├── classifier.test.ts        # co-located
    ├── classifier-pipeline.test.ts
    ├── dateValidation.test.ts
    ├── exportUtils.test.ts
    └── image-upload.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
// Pattern: file-level doc comment, imports, section-divided structure
/**
 * Unit tests for GET /api/events
 * Covers: [list of scenarios]
 * Supabase and tagMapping are mocked -- no live DB required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Types ───────────────────────────────────────────────
interface MockEvent { /* ... */ }

// ─── Fixtures ────────────────────────────────────────────
function makeEvent(overrides: Partial<MockEvent> = {}): MockEvent { /* ... */ }

// ─── Mocks ───────────────────────────────────────────────
vi.mock("@/lib/supabase/server", () => ({ /* ... */ }));

// ─── Helpers ─────────────────────────────────────────────
function makeRequest(params: Record<string, string> = {}): NextRequest { /* ... */ }

// ─── Module reset ────────────────────────────────────────
let GET: (req: NextRequest) => Promise<Response>;
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  // Re-import route handler after mock reset
  const routeModule = await import("@/app/api/events/route");
  GET = routeModule.GET;
});

// ─── Test Groups ─────────────────────────────────────────
describe("GET /api/events -- success", () => { /* ... */ });
describe("GET /api/events -- error handling", () => { /* ... */ });
```

**Patterns:**
- Use section dividers with `// ─── Section Name ───` lines
- Group related tests in nested `describe()` blocks named after the endpoint and scenario category
- `beforeEach` for mock reset and module re-import (API route tests)
- `afterEach` with `cleanup()` and `vi.clearAllMocks()` for component tests
- Test names use descriptive sentences: `"returns 200 with events array and pagination metadata"`

## Mocking

**Framework:** Vitest built-in `vi` (compatible with Jest mocking API)

**Supabase Server Client Mock (most common pattern):**
```typescript
// Pattern from src/__tests__/api/events/get-events.test.ts
const mockSupabase = {
  from: vi.fn(),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

// Chainable query builder
function createChainableBuilder() {
  const builder: Record<string, unknown> = {};
  const chainMethods = ["select", "eq", "order", "overlaps", "or", "gte", "lte"];
  for (const method of chainMethods) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  // Terminal method resolves the query
  builder.range = vi.fn().mockImplementation(() => Promise.resolve(mockQueryResult));
  return builder;
}
```

**Supabase Auth Mock:**
```typescript
// Pattern from src/__tests__/api/events/rsvp.test.ts
let mockUser: { id: string } | null = null;
let mockAuthError: { message: string } | null = null;

const mockSupabase = {
  auth: {
    getUser: vi.fn(() =>
      Promise.resolve({
        data: { user: mockUser },
        error: mockAuthError,
      })
    ),
  },
  from: vi.fn((table: string) => { /* table-specific mock */ }),
};
```

**Global Fetch Mock:**
```typescript
// Pattern from src/hooks/useEvents.test.ts
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Or using stubGlobal:
vi.stubGlobal("fetch", mockFetch);
```

**Component Child Mock:**
```typescript
// Pattern from src/components/events/FilterSidebar.test.tsx
vi.mock("@/components/events/EventFilters", () => ({
  EventFilters: ({ onFilterChange, initialTags }: any) => (
    <div data-testid="mock-event-filters">
      <button onClick={() => onFilterChange?.({ tags: ["academic"] })}>
        Trigger Filter
      </button>
    </div>
  ),
}));
```

**Hoisted Mocks (for module-level import):**
```typescript
// Pattern from src/app/api/events/export/route.test.ts
const { mockFrom, mockQuery, mockEvents } = vi.hoisted(() => {
  // Define mocks that must exist before module import
  return { mockFrom, mockQuery, mockEvents };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));
```

**What to Mock:**
- Supabase client (both server and browser): always mock, never hit real DB
- `@/lib/tagMapping`: mock to pass-through when not testing tag transformation
- Global `fetch`: mock in hook/utility tests
- Child components: mock when testing parent behavior in isolation
- `window.URL.createObjectURL` / `revokeObjectURL`: mock in download/export tests
- `console.error`: spy and suppress in ErrorBoundary tests

**What NOT to Mock:**
- Pure utility functions under test (e.g., `isValidISODate`, `classifyPost`, `extractDate`)
- React Testing Library utilities
- NextRequest/NextResponse constructors (use real instances)

## Fixtures and Factories

**Test Data:**
```typescript
// Factory function pattern (most common)
// From src/__tests__/api/events/get-events.test.ts
function makeEvent(overrides: Partial<MockEvent> = {}): MockEvent {
  return {
    id: "evt-1",
    title: "Hackathon 2099",
    description: "A coding competition",
    start_date: "2099-06-15T10:00:00Z",
    // ... all fields with defaults
    ...overrides,
  };
}

// From src/hooks/useEvents.test.ts
const createMockEvent = (id: string, date: string = "2026-02-25"): Event => ({
  id,
  title: `Event ${id}`,
  // ... derived from parameters
});

// API response wrapper
const mockApiResponse = (events: Event[], total: number, nextCursor: string | null = null) => ({
  ok: true,
  json: async () => ({ events, total, nextCursor }),
});
```

**Constants for Test Data:**
```typescript
// Pattern from src/__tests__/api/events/date-validation.test.ts
const FUTURE_DATE = "2099-12-31";
const FUTURE_DATETIME = "2099-12-31T09:00:00Z";
const PAST_DATE = "2000-01-01";
```

**Location:**
- Fixtures defined inline at the top of each test file
- No shared fixtures directory -- each test is self-contained
- Factory functions use `make` or `create` prefix

## Coverage

**Requirements:** None enforced. No coverage thresholds configured in `vitest.config.ts`.

**View Coverage:**
```bash
npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- Pure functions: `src/lib/dateValidation.test.ts`, `src/lib/classifier.test.ts`
- Tested in isolation with direct function imports
- No mocking needed for pure logic

**API Route Tests:**
- `src/__tests__/api/events/get-events.test.ts`, `src/__tests__/api/events/rsvp.test.ts`
- `src/app/api/events/route.test.ts`, `src/app/api/events/export/route.test.ts`
- Mock Supabase client, import and call route handler functions directly
- Test HTTP status codes, response body shape, and Supabase query builder calls
- Use `vi.resetModules()` + dynamic `import()` in `beforeEach` to get fresh handler per test

**Component Tests:**
- `src/components/ErrorBoundary.test.tsx`, `src/components/events/EventFilters.test.tsx`
- Use `@testing-library/react` (`render`, `screen`, `fireEvent`, `waitFor`)
- Test rendering, user interactions, and callback invocations
- Mock child components to isolate parent behavior

**Hook Tests:**
- `src/hooks/useEvents.test.ts`
- Use `renderHook` and `act` from `@testing-library/react`
- Mock global `fetch` to control API responses
- Test state transitions, pagination, error handling

**Pipeline/Integration Tests:**
- `src/lib/classifier-pipeline.test.ts`
- Test multi-step data transformations end-to-end
- Mock external services (fetch, Supabase storage) but exercise internal pipeline logic

## Common Patterns

**Async Testing:**
```typescript
// API route test pattern
it("returns 200 with events", async () => {
  const res = await GET(makeRequest());
  expect(res.status).toBe(200);

  const body = await res.json();
  expect(body.events).toHaveLength(1);
});

// Hook test with waitFor
it("should fetch events on mount", async () => {
  mockFetch.mockResolvedValueOnce(mockApiResponse(events, 2));
  const { result } = renderHook(() => useEvents());

  expect(result.current.loading).toBe(true);
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
  });
  expect(result.current.events).toEqual(events);
});
```

**Error Testing:**
```typescript
// API route error pattern
it("returns 500 when Supabase returns an error", async () => {
  mockQueryResult = {
    data: null,
    error: { message: "Database connection failed" },
    count: null,
  };
  const res = await GET(makeRequest());
  expect(res.status).toBe(500);
  const body = await res.json();
  expect(body).toHaveProperty("error");
});

// Hook error pattern
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

**Dynamic Module Import Pattern (API route tests):**
```typescript
// Reset and re-import route handlers in beforeEach to get clean mock state
let GET: (req: NextRequest) => Promise<Response>;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mockQueryResult = { data: [makeEvent()], error: null, count: 1 };
  mockSupabase.from.mockImplementation(() => createChainableBuilder());

  const routeModule = await import("@/app/api/events/route");
  GET = routeModule.GET as typeof GET;
});
```

**Component Interaction Testing:**
```typescript
// From src/components/events/EventFilters.test.tsx
it("calls onFilterChange when a category is toggled on", async () => {
  const handleFilterChange = vi.fn();
  render(<EventFilters onFilterChange={handleFilterChange} />);

  const button = screen.getByRole("button", { name: categoryLabel });
  fireEvent.click(button);

  await waitFor(() => {
    expect(handleFilterChange).toHaveBeenCalledTimes(1);
    expect(handleFilterChange).toHaveBeenCalledWith({ tags: [targetTag] });
  });
});
```

## Test File Count

| Category | Count | Files |
|----------|-------|-------|
| API route tests | 5 | `src/__tests__/api/events/*.test.ts` (3), `src/app/api/events/route.test.ts`, `src/app/api/events/export/route.test.ts` |
| Component tests | 3 | `ErrorBoundary.test.tsx`, `EventFilters.test.tsx`, `FilterSidebar.test.tsx` |
| Hook tests | 1 | `useEvents.test.ts` |
| Lib/utility tests | 5 | `classifier.test.ts`, `classifier-pipeline.test.ts`, `dateValidation.test.ts`, `exportUtils.test.ts`, `image-upload.test.ts` |
| **Total** | **14** | (excluding `kmeans.test.ts` which is excluded from vitest config) |

---

*Testing analysis: 2026-03-05*
