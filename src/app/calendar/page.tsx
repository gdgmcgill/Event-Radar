"use client";

/**
 * Calendar page - Monthly calendar view of events
 */

import { useState, useEffect, useCallback } from "react";
import type { Event } from "@/types";
import { EventDetailsModal } from "@/components/events/EventDetailsModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTracking } from "@/hooks/useTracking";

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/events");
      
      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await response.json();
      const eventList = Array.isArray(data) ? data : data.events || [];
      setEvents(eventList);
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => event.event_date === dateStr);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Create calendar grid
  const calendarDays = [];
  // Add empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null);
  }
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push(new Date(year, month, day));
  }

  const { trackClick } = useTracking({ source: "calendar" });

  const handleEventClick = (event: Event) => {
    trackClick(event.id);
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-xl">
              <CalendarIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Calendar</h1>
              <p className="text-sm text-muted-foreground">View all upcoming events</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={goToToday} className="rounded-xl">
              Today
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateMonth('prev')}
                className="rounded-xl"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[180px] text-center">
                <span className="text-lg font-semibold text-foreground">{monthName}</span>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateMonth('next')}
                className="rounded-xl"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-card rounded-2xl border border-border shadow-md overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 bg-secondary/30 border-b border-border">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div
                key={day}
                className="p-3 text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 auto-rows-fr">
            {calendarDays.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="border-r border-b border-border/50 min-h-[120px] bg-secondary/5" />;
              }

              const dateStr = date.toISOString().split('T')[0];
              const dayEvents = getEventsForDate(date);
              const isToday = dateStr === todayStr;
              const isPast = date < today && dateStr !== todayStr;

              return (
                <div
                  key={dateStr}
                  className={cn(
                    "border-r border-b border-border/50 min-h-[120px] p-2 transition-colors hover:bg-secondary/30",
                    isPast && "bg-secondary/5"
                  )}
                >
                  <div className="flex flex-col h-full">
                    <div className="flex justify-between items-start mb-2">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isToday && "flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground",
                          !isToday && "text-foreground",
                          isPast && !isToday && "text-muted-foreground"
                        )}
                      >
                        {date.getDate()}
                      </span>
                      {dayEvents.length > 0 && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                          {dayEvents.length}
                        </Badge>
                      )}
                    </div>

                    <div className="flex-1 space-y-1 overflow-y-auto max-h-[80px]">
                      {dayEvents.slice(0, 3).map(event => (
                        <button
                          key={event.id}
                          onClick={() => handleEventClick(event)}
                          className="w-full text-left p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors text-xs truncate border-l-2 border-primary"
                        >
                          <div className="font-medium text-foreground truncate">
                            {event.event_time} {event.title}
                          </div>
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <button
                          onClick={() => handleEventClick(dayEvents[3])}
                          className="w-full text-left px-1.5 py-1 text-xs text-primary hover:underline"
                        >
                          +{dayEvents.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-primary" />
            <span>Today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-l-2 border-primary bg-primary/10" />
            <span>Event</span>
          </div>
        </div>
      </div>

      {/* Event Details Modal */}
      <EventDetailsModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) setSelectedEvent(null);
        }}
        event={selectedEvent}
        trackingSource="calendar"
      />
    </div>
  );
}

