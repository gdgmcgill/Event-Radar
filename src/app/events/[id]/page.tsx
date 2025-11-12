/**
 * Event detail page
 * TODO: Implement event fetching by ID, save functionality, and related events
 */

import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { EVENT_CATEGORIES } from "@/lib/constants";
import type { Event } from "@/types";
import { Calendar, Clock, MapPin, Heart, ArrowLeft } from "lucide-react";

interface EventDetailPageProps {
  params: {
    id: string;
  };
}

async function getEvent(id: string): Promise<Event | null> {
  // TODO: Fetch event from API
  // const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/events/${id}`);
  // if (!response.ok) return null;
  // return response.json();
  return null;
}

export default async function EventDetailPage({
  params,
}: EventDetailPageProps) {
  const event = await getEvent(params.id);

  if (!event) {
    notFound();
  }

  const handleSave = () => {
    // TODO: Implement save event logic
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <Link href="/">
        <Button variant="ghost" className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Events
        </Button>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Event Image */}
          <div className="relative h-96 w-full overflow-hidden rounded-lg bg-muted">
            {event.image_url ? (
              <Image
                src={event.image_url}
                alt={event.title}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No Image Available
              </div>
            )}
          </div>

          {/* Event Details */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <CardTitle className="text-3xl">{event.title}</CardTitle>
                <Button variant="outline" size="icon" onClick={handleSave}>
                  <Heart className="h-5 w-5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-lg">{event.description}</p>

              <div className="space-y-3">
                <div className="flex items-center text-muted-foreground">
                  <Calendar className="mr-3 h-5 w-5" />
                  {formatDateTime(event.event_date, event.event_time)}
                </div>
                <div className="flex items-center text-muted-foreground">
                  <MapPin className="mr-3 h-5 w-5" />
                  {event.location}
                </div>
                {event.club && (
                  <div className="text-muted-foreground">
                    Organized by{" "}
                    <Link
                      href={`/clubs/${event.club.id}`}
                      className="text-primary hover:underline"
                    >
                      {event.club.name}
                    </Link>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 pt-4">
                {event.tags.map((tag) => {
                  const category = EVENT_CATEGORIES[tag];
                  return (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className={category.color}
                    >
                      {category.label}
                    </Badge>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* TODO: Add related events */}
          {/* TODO: Add share functionality */}
        </div>
      </div>
    </div>
  );
}

