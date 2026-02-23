import React from "react";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FilterSidebar } from "@/components/events/FilterSidebar";

// Mock the EventFilters child component to isolate testing
vi.mock("@/components/events/EventFilters", () => ({
  EventFilters: ({ onFilterChange, initialTags }: any) => (
    <div data-testid="mock-event-filters">
      <button 
        data-testid="mock-filter-button" 
        onClick={() => onFilterChange?.({ tags: ["academic"] })}
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
    
    // Check that width is 0 and it has opacity 0
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("w-0");
    expect(wrapper).toHaveClass("opacity-0");
    expect(wrapper).toHaveClass("-translate-x-4");
  });

  it("renders open when isOpen is true", () => {
    const { container } = render(
      <FilterSidebar isOpen={true} onToggle={() => {}} />
    );
    
    // Check that it's expanded
    const wrapper = container.firstChild as HTMLElement;
    // Check inner wrapper
    expect(wrapper).toHaveClass("opacity-100");
    expect(wrapper).toHaveClass("translate-x-0");
    expect(wrapper).not.toHaveClass("w-0");
  });

  it("passes props correctly to child component", () => {
    const mockOnFilterChange = vi.fn();
    render(
      <FilterSidebar 
        isOpen={true} 
        onToggle={() => {}} 
        onFilterChange={mockOnFilterChange}
        initialTags={["academic"]}
      />
    );
    
    // Ensure initial tags are passed through
    expect(screen.getByTestId("mock-initial-tags")).toHaveTextContent("academic");

    // Ensure filtering works
    fireEvent.click(screen.getByTestId("mock-filter-button"));
    expect(mockOnFilterChange).toHaveBeenCalledWith({ tags: ["academic"] });
  });

  it("applies custom className", () => {
    const { container } = render(
      <FilterSidebar isOpen={true} onToggle={() => {}} className="custom-test-class" />
    );
    
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("custom-test-class");
  });
});
