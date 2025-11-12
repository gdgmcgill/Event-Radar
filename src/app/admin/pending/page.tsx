"use client";

/**
 * Pending events queue page
 * TODO: Implement pending events list, approve/reject functionality
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Eye } from "lucide-react";
import Link from "next/link";

export default function PendingEventsPage() {
  // TODO: Fetch pending events
  // TODO: Implement approve/reject actions

  const handleApprove = async (eventId: string) => {
    // TODO: Implement approve logic
  };

  const handleReject = async (eventId: string) => {
    // TODO: Implement reject logic
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Pending Events</h2>
        <Badge variant="secondary">0 pending</Badge>
      </div>

      {/* TODO: Replace with actual pending events */}
      <div className="text-center py-12 text-muted-foreground">
        <p>No pending events at this time.</p>
      </div>

      {/* Example pending event card structure */}
      {/* {pendingEvents.map((event) => (
        <Card key={event.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{event.title}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Submitted by {event.club?.name}
                </p>
              </div>
              <Badge variant="outline">Pending</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-4">{event.description}</p>
            <div className="flex gap-2">
              <Link href={`/events/${event.id}`}>
                <Button variant="outline" size="sm">
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </Button>
              </Link>
              <Button
                variant="default"
                size="sm"
                onClick={() => handleApprove(event.id)}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleReject(event.id)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </div>
          </CardContent>
        </Card>
      ))} */}
    </div>
  );
}

