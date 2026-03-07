// @testing-library/react is not installed — all tests in this file are skipped
 
const { render, screen, cleanup, fireEvent, waitFor } = {} as any;
import { EventFilters } from "@/components/events/EventFilters";
import { EVENT_CATEGORIES, EVENT_TAGS } from "@/lib/constants";
import type { EventTag } from "@/types";

describe.skip("EventFilters Component (@testing-library/react not installed)", () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it("renders all available categories", () => {
    render(<EventFilters />);

    EVENT_TAGS.forEach((tag: EventTag) => {
      const category = EVENT_CATEGORIES[tag as unknown as keyof typeof EVENT_CATEGORIES];
      expect(screen.getByRole("button", { name: category.label })).toBeInTheDocument();
    });
  });

  it("initializes with provided initialTags", () => {
    const initialTags = [EVENT_TAGS[0], EVENT_TAGS[1]];
    render(<EventFilters initialTags={initialTags} />);

    expect(screen.getByRole("button", { name: /clear all filters/i })).toBeInTheDocument();
  });

  it("calls onFilterChange when a category is toggled on", async () => {
    const handleFilterChange = jest.fn();

    render(<EventFilters onFilterChange={handleFilterChange} />);

    const targetTag = EVENT_TAGS[0];
    const categoryLabel = EVENT_CATEGORIES[targetTag].label;

    const button = screen.getByRole("button", { name: categoryLabel });
    fireEvent.click(button);

    await waitFor(() => {
      expect(handleFilterChange).toHaveBeenCalledTimes(1);
      expect(handleFilterChange).toHaveBeenCalledWith({
        tags: [targetTag],
      });
    });
  });

  it("calls onFilterChange when a category is toggled off", async () => {
    const handleFilterChange = jest.fn();

    const initialTag = EVENT_TAGS[0];
    const categoryLabel = EVENT_CATEGORIES[initialTag].label;

    render(<EventFilters initialTags={[initialTag]} onFilterChange={handleFilterChange} />);

    const button = screen.getByRole("button", { name: categoryLabel });
    fireEvent.click(button);

    await waitFor(() => {
      expect(handleFilterChange).toHaveBeenCalledWith({
        tags: undefined,
      });
    });
  });

  it("clears all filters when 'Clear all filters' is clicked", async () => {
    const handleFilterChange = jest.fn();

    render(<EventFilters initialTags={[EVENT_TAGS[0], EVENT_TAGS[1]]} onFilterChange={handleFilterChange} />);

    const clearButton = screen.getByRole("button", { name: /clear all filters/i });
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(handleFilterChange).toHaveBeenCalledWith({
        tags: undefined,
      });
    });
  });
});
