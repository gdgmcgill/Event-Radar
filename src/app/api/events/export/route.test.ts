import { vi, describe, it, expect, beforeEach } from "vitest";

// Must be hoisted so the mock is registered before the module import
const { mockFrom, mockQuery, mockEvents } = vi.hoisted(() => {
    const mockEvents = [
        {
            id: "1f4f1a1a-1111-4f4f-9a9a-111111111111",
            title: "Test Event",
            description: "Line1\nLine2, semicolon; backslash \\",
            start_date: "2024-05-01T12:00:00Z",
            end_date: "2024-05-01T14:00:00Z",
            location: "Test Location",
            status: "approved",
            category: "Academic",
            tags: ["tech", "coding"],
            image_url: "https://example.com/image.png",
            created_by: "user-1",
            created_at: "2024-04-01T10:00:00Z",
            updated_at: "2024-04-02T10:00:00Z",
            approved_by: "admin-1",
            approved_at: "2024-04-03T10:00:00Z",
            source: "manual",
            source_url: "https://example.com/source",
            organizer: "Tech Club",
            rsvp_count: 42,
            club: {
                id: "club-1",
                name: "Tech Club",
                instagram_handle: "@techclub",
                logo_url: "https://example.com/logo.png",
                description: "Club description",
                category: "Tech",
                status: "approved",
                created_by: "user-2",
                created_at: "2023-01-01T10:00:00Z",
                updated_at: "2023-02-01T10:00:00Z",
            },
        },
    ];

    const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        overlaps: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
            resolve({ data: mockEvents, error: null }),
    };

    const mockFrom = vi.fn().mockReturnValue(mockQuery);
    return { mockFrom, mockQuery, mockEvents };
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
        mockQuery.select.mockClear();
        mockQuery.eq.mockClear();
        mockQuery.in.mockClear();
        mockQuery.order.mockClear();
        mockQuery.overlaps.mockClear();
        mockQuery.or.mockClear();
        mockQuery.gte.mockClear();
        mockQuery.lte.mockClear();
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
        expect(text).toContain("event_id,title,description,start_date,end_date,location,category,tags,image_url,source_url,organizer,rsvp_count,club_name,club_instagram_handle,club_description");
        expect(text).toContain('"Test Event"');
        expect(text).toContain('"tech, coding"');
        expect(text).toContain('"Tech Club"');
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
        expect(text).toContain("DESCRIPTION:Line1\\nLine2\\, semicolon\\; backslash \\\\");
        expect(text).toContain("END:VCALENDAR");
    });

    it("should return 400 if eventId is invalid", async () => {
        const req = new NextRequest("http://localhost:3000/api/events/export?format=csv&eventId=not-a-uuid");
        const res = await GET(req);
        if (!res) throw new Error("Response is undefined");
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe("eventId must be a valid UUID");
    });

    it("should filter by eventId", async () => {
        const eventId = mockEvents[0].id;
        const req = new NextRequest(`http://localhost:3000/api/events/export?format=csv&eventId=${eventId}`);
        const res = await GET(req);
        if (!res) throw new Error("Response is undefined");
        expect(res.status).toBe(200);
        expect(mockQuery.eq).toHaveBeenCalledWith("id", eventId);
    });

    it("should filter by eventIds", async () => {
        const eventIds = [
            "1f4f1a1a-1111-4f4f-9a9a-111111111111",
            "2f4f1a1a-2222-4f4f-9a9a-222222222222",
        ];
        const req = new NextRequest(`http://localhost:3000/api/events/export?format=csv&eventIds=${eventIds.join(",")}`);
        const res = await GET(req);
        if (!res) throw new Error("Response is undefined");
        expect(res.status).toBe(200);
        expect(mockQuery.in).toHaveBeenCalledWith("id", eventIds);
    });

    it("should return 400 if eventIds contains invalid UUID", async () => {
        const req = new NextRequest("http://localhost:3000/api/events/export?format=csv&eventIds=not-a-uuid");
        const res = await GET(req);
        if (!res) throw new Error("Response is undefined");
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe("eventIds must be a comma-separated list of valid UUIDs");
    });

    it("should return 400 if eventId and eventIds are both provided", async () => {
        const eventId = mockEvents[0].id;
        const req = new NextRequest(`http://localhost:3000/api/events/export?format=csv&eventId=${eventId}&eventIds=${eventId}`);
        const res = await GET(req);
        if (!res) throw new Error("Response is undefined");
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBe("Provide either eventId or eventIds, not both");
    });
});
