import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

type EventRow = Database["public"]["Tables"]["events"]["Row"] & {
    approved_by?: string | null;
    approved_at?: string | null;
    source?: string | null;
    source_url?: string | null;
    club?: ClubRow | null;
};

type ClubRow = Database["public"]["Tables"]["clubs"]["Row"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CSV_HEADERS = [
    "event_id",
    "title",
    "description",
    "start_date",
    "end_date",
    "location",
    "category",
    "tags",
    "image_url",
    "source_url",
    "organizer",
    "rsvp_count",
    "club_name",
    "club_instagram_handle",
    "club_description",
];

const escapeCsvValue = (value: string) => `"${value.replace(/"/g, '""')}"`;

const toCsvValue = (value: unknown) => {
    if (value === null || value === undefined) return '""';
    if (Array.isArray(value)) return escapeCsvValue(value.join(", "));
    return escapeCsvValue(String(value));
};

const formatDateForICal = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
};

const escapeICalText = (value: string) =>
    value
        .replace(/\\/g, "\\\\")
        .replace(/\r\n|\n|\r/g, "\\n")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,");

/**
 * @swagger
 * /api/events/export:
 *   get:
 *    summary: /api/events/export
 *    description: Export approved events as CSV or iCal
 *    tags:
 *      - Events
 *    parameters:
 *      - name: format
 *        description: Export format
 *        in: query
 *        required: true
 *        schema:
 *          type: string
 *          enum: [csv, ical]
 *      - name: tags
 *        description: Comma-separated list of tags
 *        in: query
 *        required: false
 *        schema:
 *          type: string
 *      - name: search
 *        description: Search query
 *        in: query
 *        required: false
 *        schema:
 *          type: string
 *      - name: dateFrom
 *        description: Start date for filtering
 *        in: query
 *        required: false
 *        schema:
 *          type: string
 *      - name: dateTo
 *        description: End date for filtering
 *        in: query
 *        required: false
 *        schema:
 *          type: string
 *      - name: clubId
 *        description: Filter by club id
 *        in: query
 *        required: false
 *        schema:
 *          type: string
 *      - name: eventId
 *        description: Export a single event by id
 *        in: query
 *        required: false
 *        schema:
 *          type: string
 *    responses:
 *      200:
 *        description: Export file
 *        content:
 *          text/csv:
 *            schema:
 *              type: string
 *          text/calendar:
 *            schema:
 *              type: string
 *      400:
 *        description: Validation error
 *      500:
 *        description: Internal server error
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const searchParams = request.nextUrl.searchParams;

        const format = searchParams.get('format');
        if (format !== 'csv' && format !== 'ical') {
            return NextResponse.json({ error: "format parameter must be 'csv' or 'ical'" }, { status: 400 });
        }

        const tags = searchParams.get("tags");
        const search = searchParams.get("search");
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");
        const clubId = searchParams.get("clubId");
        const eventId = searchParams.get("eventId");

        if (eventId && !UUID_RE.test(eventId)) {
            return NextResponse.json({ error: "eventId must be a valid UUID" }, { status: 400 });
        }

        let eventsQuery = supabase
            .from("events")
            .select("*, club:clubs(*)")
            .eq("status", "approved")
            .order("start_date", { ascending: true });

        // Apply filters
        if (tags) {
            const tagArray = tags.split(',').map(tag => tag.trim());
            eventsQuery = eventsQuery.overlaps("tags", tagArray);
        }

        if (search) {
            const sanitized = search.replace(/[%_(),]/g, "");
            if (sanitized) {
                eventsQuery = eventsQuery.or(
                    `title.ilike.%${sanitized}%,description.ilike.%${sanitized}%`
                );
            }
        }

        if (dateFrom) {
            eventsQuery = eventsQuery.gte("start_date", dateFrom);
        }

        if (dateTo) {
            eventsQuery = eventsQuery.lte("start_date", dateTo);
        }

        if (clubId) {
            eventsQuery = eventsQuery.eq("club_id", clubId);
        }

        if (eventId) {
            eventsQuery = eventsQuery.eq("id", eventId);
        }

        // Execute query
        const { data: eventsData, error: eventsError } = await eventsQuery;

        if (eventsError) {
            console.error("Supabase error fetching events for export:", eventsError);
            return NextResponse.json({ error: eventsError.message }, { status: 500 });
        }

        const dbEvents = (eventsData ?? []) as unknown as EventRow[];

        if (format === "csv") {
            const rows = dbEvents.map((event) => {
                const club = event.club ?? null;
                return [
                    toCsvValue(event.id),
                    toCsvValue(event.title),
                    toCsvValue(event.description),
                    toCsvValue(event.start_date),
                    toCsvValue(event.end_date ?? ""),
                    toCsvValue(event.location),
                    toCsvValue(event.category ?? ""),
                    toCsvValue(event.tags ?? []),
                    toCsvValue(event.image_url ?? ""),
                    toCsvValue(event.source_url ?? ""),
                    toCsvValue(event.organizer ?? ""),
                    toCsvValue(event.rsvp_count ?? 0),
                    toCsvValue(club?.name ?? ""),
                    toCsvValue(club?.instagram_handle ?? ""),
                    toCsvValue(club?.description ?? ""),
                ].join(",");
            });

            const csvContent = [CSV_HEADERS.join(","), ...rows].join("\n");

            return new NextResponse(csvContent, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': 'attachment; filename="events.csv"',
                },
            });
        } else if (format === "ical") {
            const lineBreak = "\r\n";
            const dtstamp = formatDateForICal(new Date().toISOString());

            const icalEvents = dbEvents
                .map((event) => {
                    const dtstart = formatDateForICal(event.start_date);
                    const dtend = event.end_date ? formatDateForICal(event.end_date) : dtstart;

                    return [
                        "BEGIN:VEVENT",
                        `UID:${event.id}@event-radar.local`,
                        `DTSTAMP:${dtstamp}`,
                        `DTSTART:${dtstart}`,
                        `DTEND:${dtend}`,
                        `SUMMARY:${escapeICalText(event.title ?? "")}`,
                        `DESCRIPTION:${escapeICalText(event.description ?? "")}`,
                        `LOCATION:${escapeICalText(event.location ?? "")}`,
                        "END:VEVENT",
                    ].join(lineBreak);
                })
                .join(lineBreak);

            const icalContent = [
                "BEGIN:VCALENDAR",
                "VERSION:2.0",
                "PRODID:-//Event Radar//EN",
                "CALSCALE:GREGORIAN",
                icalEvents,
                "END:VCALENDAR",
            ].join(lineBreak);

            return new NextResponse(icalContent, {
                status: 200,
                headers: {
                    'Content-Type': 'text/calendar',
                    'Content-Disposition': 'attachment; filename="events.ics"',
                },
            });
        }
    } catch (error) {
        console.error("Error generating export:", error);
        return NextResponse.json(
            { error: "Failed to generate export" },
            { status: 500 }
        );
    }
}
