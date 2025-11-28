"use client";

/**
 * Home page - Main event calendar/browse view
 */

import { useState, useEffect, useCallback } from "react";
import type { Event } from "@/types";

import { EventSearch } from "@/components/events/EventSearch";
import { EventFilters } from "@/components/events/EventFilters";
import { EventGrid } from "@/components/events/EventGrid";
import { EventDetailsModal } from "@/components/events/EventDetailsModal";
import { Search, Filter, RefreshCcw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export default function HomePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/events");
      
      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await response.json();
      // Handle both array response or { events: [] } format
      const eventList = Array.isArray(data) ? data : data.events || [];
      setEvents(eventList);
    } catch (err) {
      console.error("Error fetching events:", err);
      setError("Failed to load events. Please try again later.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background font-sans">
      {/* Hero Section */}
      <section className="relative w-full pt-24 pb-32 md:pt-32 md:pb-40 overflow-hidden bg-secondary/30">
        <div className="container mx-auto px-4 relative z-10 flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            Live on Campus
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-foreground mb-6 max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100 leading-[1.1]">
            Find your next <span className="text-primary">experience.</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200 leading-relaxed">
            Discover workshops, hackathons, and social events happening right now at McGill University.
          </p>
          
          {/* Centralized Search */}
          <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500"></div>
              <div className="relative bg-card rounded-2xl shadow-xl border border-border/50 p-2 flex items-center transition-all duration-300 focus-within:ring-2 focus-within:ring-primary/20">
                <Search className="ml-4 h-5 w-5 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Search events, clubs, or categories..." 
                  className="flex-1 bg-transparent border-none outline-none px-4 py-3.5 text-foreground placeholder:text-muted-foreground/70 text-base md:text-lg"
                />
                <button className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-all duration-200 shadow-md hover:shadow-lg active:scale-95">
                  Search
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Decorative Background Elements */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-[30%] -left-[10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-[120px]"></div>
          <div className="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-accent/10 blur-[100px]"></div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-12 -mt-16 relative z-20">
        <div className="flex flex-col gap-8">
          
          {/* Header & Filters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/40">
            <h2 className="text-3xl font-bold text-foreground tracking-tight">Upcoming Events</h2>
            
            <div className="flex items-center gap-3">
              <div className="hidden md:block">
                {/* We can place refined quick filters here or keep them in the modal/sidebar */}
              </div>
              
              {/* Mobile/Desktop Filter Toggle */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="gap-2 rounded-xl border-border/60 bg-card/50 backdrop-blur-sm hover:bg-card hover:text-primary transition-all shadow-sm">
                    <Filter className="h-4 w-4" />
                    Filters
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px] border-l-border/60">
                  <SheetHeader>
                    <SheetTitle className="text-2xl font-bold">Filters</SheetTitle>
                    <SheetDescription>
                      Refine your event search by category, date, or club.
                    </SheetDescription>
                  </SheetHeader>
                  <div className="py-6">
                    <EventFilters />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* Main Content */}
          <div className="min-h-[500px]">
            {error ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 bg-card rounded-2xl border border-destructive/20 p-8">
                <div className="rounded-full bg-destructive/10 p-4">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-foreground">Something went wrong</h3>
                  <p className="text-muted-foreground max-w-md mx-auto">{error}</p>
                </div>
                <Button onClick={fetchEvents} variant="outline" className="gap-2">
                  <RefreshCcw className="h-4 w-4" />
                  Try Again
                </Button>
              </div>
            ) : (
              <EventGrid
                events={events}
                loading={loading}
                onEventClick={handleEventClick}
              />
            )}
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
      />
    </div>
  );
}
