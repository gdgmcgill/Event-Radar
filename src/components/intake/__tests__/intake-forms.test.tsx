/** M3 P1-09 public intake forms: honeypot shape, typed bodies, the three
 * outcomes (accepted, rate-limited, network failure keeps the text) and the
 * keyboard-operable report dialog. */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SubmitForm } from "../SubmitForm";
import { CompanyRequestForm } from "../CompanyRequestForm";
import { ReportListingButton } from "../ReportListingButton";

const fetchMock = jest.fn();
const reply = (status: number, body: unknown = {}) =>
  ({ ok: status < 300, status, json: async () => body }) as Response;

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

function fill(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillJob() {
  fill("What are you submitting?", "job");
  fill("Title", "Research assistant");
  fill("Organization", "Neuro lab");
  fill("Link", "https://example.org/ra");
  fill("Description", "Help run experiments.");
  fill("Location", "Montréal");
}

const THANKS = "Thanks — a person reviews every submission before anything is published.";

describe("SubmitForm", () => {
  it("renders a honeypot that people and assistive technology never reach", () => {
    const { container } = render(<SubmitForm />);
    const honeypot = container.querySelector<HTMLInputElement>('input[name="website"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot).toHaveAttribute("autocomplete", "off");
    const wrapper = honeypot!.closest('[aria-hidden="true"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper).toHaveClass("sr-only");
  });

  it("posts the typed body for the chosen kind, omitting empty optional fields", async () => {
    fetchMock.mockResolvedValue(reply(202, { received: true }));
    render(<SubmitForm />);
    fillJob();
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/submissions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      kind: "job",
      title: "Research assistant",
      organization: "Neuro lab",
      source_url: "https://example.org/ra",
      description: "Help run experiments.",
      location: "Montréal",
    });
  });

  it("replaces the form with the review promise on 202 and shows no identifier", async () => {
    fetchMock.mockResolvedValue(reply(202, { received: true }));
    render(<SubmitForm />);
    fillJob();
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }));
    expect(await screen.findByText(THANKS)).toBeInTheDocument();
    expect(screen.queryByLabelText("Title")).toBeNull();
    expect(document.body.textContent).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it("shows the rate message on 429", async () => {
    fetchMock.mockResolvedValue(reply(429, { error: "Too many submissions. Try again later." }));
    render(<SubmitForm />);
    fillJob();
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many submissions. Try again later.");
  });

  it("keeps every value after a network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<SubmitForm />);
    fillJob();
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't send. Your text is still here.");
    expect(screen.getByLabelText("Title")).toHaveValue("Research assistant");
    expect(screen.getByLabelText("Description")).toHaveValue("Help run experiments.");
  });

  it("marks missing required fields with described errors and sends nothing", async () => {
    render(<SubmitForm />);
    fireEvent.click(screen.getByRole("button", { name: "Send for review" }));
    const title = screen.getByLabelText("Title");
    await waitFor(() => expect(title).toHaveAttribute("aria-invalid", "true"));
    const describedBy = title.getAttribute("aria-describedby") ?? "";
    expect(describedBy.split(" ").some((id) => document.getElementById(id)?.textContent?.includes("Required"))).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("states that contact details stay private", () => {
    render(<SubmitForm />);
    expect(screen.getByText(/contact details stay private/i)).toBeInTheDocument();
  });
});

describe("CompanyRequestForm", () => {
  it("posts the structured hiring request with the private contact", async () => {
    fetchMock.mockResolvedValue(reply(202, { received: true }));
    const { container } = render(<CompanyRequestForm />);
    expect(container.querySelector('input[name="website"]')).toHaveAttribute("tabindex", "-1");
    fill("Company name", "Acme Robotics");
    fill("About the company", "We build warehouse robots.");
    fill("Role title", "Junior developer");
    fill("What the student will do", "Write and test services.");
    fill("Must-have skills", "TypeScript");
    fill("Hours", "15 hours a week");
    fill("Compensation", "$22/hour");
    fill("Location", "Montréal");
    fill("Work mode", "hybrid");
    fill("Start date", "January 2027");
    fill("Employment type", "part_time");
    fill("Why it's worth it for a student", "Real mentorship.");
    fill("Your name", "Pat Recruiter");
    fill("Your work email", "hiring@acme.example");
    fireEvent.click(screen.getByRole("button", { name: "Send hiring request" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/company-requests");
    expect(JSON.parse(init.body)).toMatchObject({
      company_name: "Acme Robotics",
      role_title: "Junior developer",
      work_mode: "hybrid",
      employment_type: "part_time",
      contact_email: "hiring@acme.example",
    });
    expect(JSON.parse(init.body)).not.toHaveProperty("nice_to_have_skills");
    expect(await screen.findByText(THANKS)).toBeInTheDocument();
  });
});

describe("ReportListingButton", () => {
  const ID = "ad090003-0000-4000-8000-000000000001";

  it("opens a dialog that Escape closes, returning focus to the trigger", async () => {
    render(<ReportListingButton kind="event" id={ID} />);
    const trigger = screen.getByRole("button", { name: "Report a problem" });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    act(() => {
      fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("sends the chosen reason for the listing", async () => {
    fetchMock.mockResolvedValue(reply(202, { received: true }));
    render(<ReportListingButton kind="opportunity" id={ID} />);
    fireEvent.click(screen.getByRole("button", { name: "Report a problem" }));
    fireEvent.click(await screen.findByLabelText("Broken link"));
    fireEvent.change(screen.getByLabelText(/Details/), { target: { value: "Returns 404" } });
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/listing-reports");
    expect(JSON.parse(init.body)).toEqual({ kind: "opportunity", id: ID, reason: "dead_link", details: "Returns 404" });
    expect(await screen.findByText(/Thanks/)).toBeInTheDocument();
  });
});
