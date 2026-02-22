# Cursor-Based Pagination Test Suite

## Overview
Test suite for the useEvents hook that implements cursor-based pagination for events.

## Test Files

### **useEvents Hook Tests** ([src/hooks/useEvents.test.ts](../src/hooks/useEvents.test.ts))
**Status:** ✅ All 19 tests passing

Tests the core cursor-based pagination hook that powers event fetching across the app.

#### Test Coverage:
- **Initial Fetch** (3 tests)
  - Fetches events on mount
  - Respects `enabled` flag
  - Handles fetch errors gracefully

- **Cursor-Based Pagination** (3 tests)
  - Forward navigation with `goToNext()`
  - Backward navigation with `goToPrev()`
  - Prevents navigation when cursor is null

- **Load More Functionality** (3 tests)
  - Appends events to existing list
  - Prevents duplicate loads while loading
  - Respects null cursor state

- **Load All Functionality** (3 tests)
  - Fetches all pages until complete
  - Handles errors appropriately
  - Accepts filter options

- **Filters and Query Parameters** (2 tests)
  - Includes all filter params in requests
  - Resets cursor when filters change

- **Refetch Functionality** (1 test)
  - Re-fetches current page data

- **FetchPage Method** (2 tests)
  - Allows custom fetch calls
  - Handles API errors

- **Sort Options** (1 test)
  - Supports different sort fields and directions

- **Cursor Stack History** (1 test)
  - Maintains history for backward navigation

## Configuration

### vitest.config.ts
- Path alias resolution for `@/*` imports
- jsdom environment for React components
- Proper TypeScript support

### vitest.setup.ts
- Testing Library jest-dom matchers for assertions

## Test Statistics

- **Total Tests:** 21 tests (19 useEvents + 2 ErrorBoundary)
- **Passing:** 21 tests (100%)

## Running the Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test src/hooks/useEvents.test.ts

# Run in watch mode
npm test -- --watch
```

## Test Quality

### Strengths
✅ Comprehensive coverage of cursor pagination logic
✅ Tests edge cases and error conditions  
✅ Proper async handling with `waitFor`
✅ Good isolation with mocks
✅ Clear test descriptions and structure

### Best Practices Applied
- Proper mock cleanup in `beforeEach`/`afterEach`
- Async state updates handled correctly
- Realistic test data generation
- Testing both happy and error paths
- Independent tests (no cross-test dependencies)

## What's Not Tested

**Page-level integration** (Calendar, Categories) and **API endpoint** testing require a full Next.js test environment or E2E testing framework (Playwright/Cypress). The useEvents hook tests cover the core pagination logic that these pages depend on.
