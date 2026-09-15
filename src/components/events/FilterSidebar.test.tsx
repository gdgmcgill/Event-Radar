import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
// Imported before the component under test on purpose: jest.mock is hoisted above
// the imports, and the factory below reads EventTag when EventFilters is first
// required — which happens while the FilterSidebar import is being resolved.
import { EventTag } from "@/types";
import { FilterSidebar } from "@/components/events/FilterSidebar";

jest.mock("@/components/events/EventFilters", () => ({

  EventFilters: ({ onFilterChange, initialTags }: any) => (
    <div data-testid="mock-event-filters">
      <button
        data-testid="mock-filter-button"
        onClick={() => onFilterChange?.({ tags: [EventTag.ACADEMIC] })}
      >
        Trigger Filter
      </button>
      <span data-testid="mock-initial-tags">{initialTags?.join(",")}</span>
    </div>
  ),
}));

describe("FilterSidebar", () => {
  it("renders closed when isOpen is false", () => {
    const { container } = render(
      <FilterSidebar isOpen={false} onToggle={() => {}} />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("w-0");
    expect(wrapper).toHaveClass("opacity-0");
    expect(wrapper).toHaveClass("-translate-x-4");
  });

  it("renders open when isOpen is true", () => {
    const { container } = render(
      <FilterSidebar isOpen={true} onToggle={() => {}} />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("opacity-100");
    expect(wrapper).toHaveClass("translate-x-0");
    expect(wrapper).not.toHaveClass("w-0");
  });

  it("passes props correctly to child component", () => {
    const mockOnFilterChange = jest.fn();
    render(
      <FilterSidebar
        isOpen={true}
        onToggle={() => {}}
        onFilterChange={mockOnFilterChange}
        initialTags={[EventTag.ACADEMIC]}
      />
    );

    expect(screen.getByTestId("mock-initial-tags")).toHaveTextContent(
      EventTag.ACADEMIC
    );

    fireEvent.click(screen.getByTestId("mock-filter-button"));
    expect(mockOnFilterChange).toHaveBeenCalledWith({
      tags: [EventTag.ACADEMIC],
    });
  });

  it("applies custom className", () => {
    const { container } = render(
      <FilterSidebar isOpen={true} onToggle={() => {}} className="custom-test-class" />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("custom-test-class");
  });
});
