import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";
import { transformEventFromDB } from "@/lib/tagMapping";

export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();
        const searchParams = request.nextUrl.searchParams;

        const format = searchParams.get('format');
        if (format !== 'csv' && format !== 'ical') {
            return NextResponse.json({ error: "format parameter must be 'csv' or 'ical'" }, { status: 400 });
        }

        const tags = searchParams.get('tags');
        const search = searchParams.get('search');
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');
        const clubId = searchParams.get("clubId");

        let eventsQuery = supabase
            .from("events")
            .select("*")
            .eq("status", "approved")
            .order("start_date", { ascending: true }); // Generally useful to order by start date for exports

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

        // Execute query
        const { data: eventsData, error: eventsError } = await eventsQuery;

        if (eventsError) {
            console.error("Supabase error fetching events for export:", eventsError);
            return NextResponse.json({ error: eventsError.message }, { status: 500 });
        }

        const dbEvents = eventsData ?? [];

        if (format === 'csv') {
            // Generate CSV
            const headers = ['Title', 'Description', 'Start Date', 'End Date', 'Location', 'Category', 'Tags'];

            const escapeCsv = (str: string | null | undefined) => {
                if (!str) return '""';
                const escaped = String(str).replace(/"/g, '""');
                return `"${escaped}"`;
            };

            const rows = dbEvents.map((event: any) => [
                escapeCsv(event.title),
                escapeCsv(event.description),
                escapeCsv(new Date(event.start_date).toISOString()),
                escapeCsv(event.end_date ? new Date(event.end_date).toISOString() : ''),
                escapeCsv(event.location),
                escapeCsv(event.category || ''),
                escapeCsv((event.tags || []).join(', '))
            ].join(','));

            const csvContent = [headers.join(','), ...rows].join('\n');

            return new NextResponse(csvContent, {
                status: 200,
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': 'attachment; filename="events.csv"',
                },
            });
        } else if (format === 'ical') {
            // Generate iCal
            const formatDateForICal = (dateStr: string) => {
                const date = new Date(dateStr);
                return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            };

            const icalEvents = dbEvents.map((event: any) => {
                const dtstart = formatDateForICal(event.start_date);
                const dtend = event.end_date ? formatDateForICal(event.end_date) : dtstart; // Fallback to start if no end
                const dtstamp = formatDateForICal(new Date().toISOString());

                const descriptionEscaped = (event.description || '').replace(/\n/g, '\\n').replace(/,/g, '\\,');
                const locationEscaped = (event.location || '').replace(/,/g, '\\,');

                return `BEGIN:VEVENT
UID:${event.id}@event-radar.local
DTSTAMP:${dtstamp}
DTSTART:${dtstart}
DTEND:${dtend}
SUMMARY:${event.title}
DESCRIPTION:${descriptionEscaped}
LOCATION:${locationEscaped}
END:VEVENT`;
            }).join('\n');

            const icalContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Event Radar//EN
CALSCALE:GREGORIAN
${icalEvents}
END:VCALENDAR`;

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
