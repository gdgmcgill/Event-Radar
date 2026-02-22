"use client";

import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, afterEach } from "vitest";
import { EventFilters } from "./EventFilters";
import { EVENT_CATEGORIES, EVENT_TAGS } from "../../lib/constants";
import type { EventTag } from "../../types";

describe("EventFilters Component", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders all available categories", () => {
    render(<EventFilters />);
    
    // Check that every tag from the constants is mapped correctly.
    EVENT_TAGS.forEach((tag: EventTag) => {
      const category = EVENT_CATEGORIES[tag as unknown as keyof typeof EVENT_CATEGORIES];
      expect(screen.getByRole("button", { name: category.label })).toBeInTheDocument();
    });
  });

  it("initializes with provided initialTags", () => {
    const initialTags = [EVENT_TAGS[0], EVENT_TAGS[1]];
    render(<EventFilters initialTags={initialTags} />);
    
    // The active filter list (desktop inline clear button) should be visible if filters are active
    expect(screen.getByRole("button", { name: /clear all filters/i })).toBeInTheDocument();
  });

  it("calls onFilterChange when a category is toggled on", async () => {
    const user = userEvent.setup();
    const handleFilterChange = vi.fn();
    
    render(<EventFilters onFilterChange={handleFilterChange} />);
    
    const targetTag = EVENT_TAGS[0];
    const categoryLabel = EVENT_CATEGORIES[targetTag].label;
    
    const button = screen.getByRole("button", { name: categoryLabel });
    await user.click(button);
    
    expect(handleFilterChange).toHaveBeenCalledTimes(1);
    expect(handleFilterChange).toHaveBeenCalledWith({
      tags: [targetTag],
    });
  });

  it("calls onFilterChange when a category is toggled off", async () => {
    const user = userEvent.setup();
    const handleFilterChange = vi.fn();
    
    const initialTag = EVENT_TAGS[0];
    const categoryLabel = EVENT_CATEGORIES[initialTag].label;
    
    render(<EventFilters initialTags={[initialTag]} onFilterChange={handleFilterChange} />);
    
    const button = screen.getByRole("button", { name: categoryLabel });
    await user.click(button);
    
    expect(handleFilterChange).toHaveBeenCalledWith({
      tags: undefined, // Empty array falls back to undefined
    });
  });

  it("clears all filters when 'Clear all filters' is clicked", async () => {
    const user = userEvent.setup();
    const handleFilterChange = vi.fn();
    
    render(<EventFilters initialTags={[EVENT_TAGS[0], EVENT_TAGS[1]]} onFilterChange={handleFilterChange} />);
    
    const clearButton = screen.getByRole("button", { name: /clear all filters/i });
    await user.click(clearButton);
    
    expect(handleFilterChange).toHaveBeenCalledWith({
      tags: undefined,
    });
  });
});
