"use client";

import { useState } from "react";
// @testing-library/react is not installed — all tests in this file are skipped
 
const { render, screen, fireEvent, waitFor } = {} as any;
import { ErrorBoundary } from "./ErrorBoundary";

function Thrower(): JSX.Element {
  throw new Error("Boom");
}

function Flaky({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Flaky error");
  }
  return <div>Recovered content</div>;
}

function ResettableWrapper() {
  const [shouldThrow, setShouldThrow] = useState(true);

  return (
    <ErrorBoundary
      fallback={(error, reset) => (
        <div>
          <div>Custom fallback: {error.message}</div>
          <button
            type="button"
            onClick={() => {
              setShouldThrow(false);
              reset();
            }}
          >
            Reset
          </button>
        </div>
      )}
    >
      <Flaky shouldThrow={shouldThrow} />
    </ErrorBoundary>
  );
}

describe.skip("ErrorBoundary (@testing-library/react not installed)", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  it("renders custom fallback and can reset", async () => {
    render(<ResettableWrapper />);

    expect(screen.getByText("Custom fallback: Flaky error")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await waitFor(() => {
      expect(screen.getByText("Recovered content")).toBeInTheDocument();
    });
  });
});
