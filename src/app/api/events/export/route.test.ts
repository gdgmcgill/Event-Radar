import { vi, describe, it, expect, beforeEach } from "vitest";

// Must be hoisted so the mock is registered before the module import
const { mockFrom } = vi.hoisted(() => {
    const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        overlaps: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
            resolve({ data: mockEvents, error: null }),
    };

    const mockEvents = [
        {
            id: "1",
            title: "Test Event",
            description: "A test event description",
            start_date: "2024-05-01T12:00:00Z",
            end_date: "2024-05-01T14:00:00Z",
            location: "Test Location",
            status: "approved",
            category: "Academic",
            tags: ["tech", "coding"],
        },
    ];

    const mockFrom = vi.fn().mockReturnValue(mockQuery);
    return { mockFrom };
});

vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        from: mockFrom,
    }),
}));

import { GET } from "./route";
import { NextRequest } from "next/server";

describe("GET /api/events/export", () => {
    beforeEach(() => {
        mockFrom.mockClear();
    });

    it("should return 400 if format is invalid", async () => {
        const req = new NextRequest("http://localhost:3000/api/events/export?format=invalid");
        const res = await GET(req);
        if (!res) throw new Error("Response is undefined");
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe("format parameter must be 'csv' or 'ical'");
    });

    it("should return CSV data with correct headers and content", async () => {
        const req = new NextRequest("http://localhost:3000/api/events/export?format=csv");
        const res = await GET(req);
        if (!res) throw new Error("Response is undefined");
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe("text/csv");
        expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="events.csv"');

        const text = await res.text();
        expect(text).toContain("Title,Description,Start Date,End Date,Location,Category,Tags");
        expect(text).toContain('"Test Event"');
        expect(text).toContain('"tech, coding"');
    });

    it("should return iCal data with correct structure", async () => {
        const req = new NextRequest("http://localhost:3000/api/events/export?format=ical");
        const res = await GET(req);
        if (!res) throw new Error("Response is undefined");
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe("text/calendar");
        expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="events.ics"');

        const text = await res.text();
        expect(text).toContain("BEGIN:VCALENDAR");
        expect(text).toContain("SUMMARY:Test Event");
        expect(text).toContain("DTSTART:20240501T120000Z");
        expect(text).toContain("END:VCALENDAR");
    });
});
