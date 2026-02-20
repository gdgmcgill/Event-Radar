"use client";

import { useState, useEffect } from "react";
import { type Event, EventTag } from "@/types";
import { EventCard } from "@/components/events/EventCard";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { useAuthStore } from "@/store/useAuthStore";
import { useSavedEvents } from "@/hooks/useSavedEvents";

interface RecommendedEventsSectionProps {
  onEventClick?: (event: Event) => void;
  // Fallback trigger if recommendation engine returns 0.
  onEmpty?: () => void;
}

export function RecommendedEventsSection({ onEventClick, onEmpty }: RecommendedEventsSectionProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);
  const { savedEventIds } = useSavedEvents(!!user);

  const generateDummyEvents = (): Event[] => {
    return [
      {
        id: "rec-1",
        title: "Intro to Machine Learning Workshop",
        description: "Join us for a beginner-friendly deep dive into Machine Learning using Python and TensorFlow. No prior experience required! (THIS IS DUMMY DATA TO BE REMOVED)",
        event_date: "2026-03-15",
        event_time: "18:00",
        location: "Trottier Building, Room 2100",
        club_id: "mcgill-ai",
        tags: [EventTag.ACADEMIC, EventTag.CAREER],
        image_url: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&q=80&w=800",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "approved",
        approved_by: "system",
        approved_at: new Date().toISOString(),
        club: {
          id: "mcgill-ai",
          name: "McGill AI Society",
          instagram_handle: "mcgill_ai",
          logo_url: null,
          description: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        saved_by_users: []
      },
      {
        id: "rec-2",
        title: "Sustainability Case Competition",
        description: "Compete with students across Canada to solve real-world sustainability challenges. Cash prizes for the winning teams! (THIS IS DUMMY DATA TO BE REMOVED)",
        event_date: "2026-03-20",
        event_time: "09:00",
        location: "Bronfman Building",
        club_id: "mus",
        tags: [EventTag.ACADEMIC, EventTag.CAREER],
        image_url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "approved",
        approved_by: "system",
        approved_at: new Date().toISOString(),
        club: {
          id: "mus",
          name: "Management Undergraduate Society",
          instagram_handle: "musmcgill",
          logo_url: null,
          description: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        saved_by_users: []
      },
      {
        id: "rec-3",
        title: "Spring Symphony Concert",
        description: "The McGill Symphony Orchestra presents an enchanting evening of classical masterpieces, featuring works by Beethoven and Tchaikovsky. (THIS IS DUMMY DATA TO BE REMOVED)",
        event_date: "2026-04-05",
        event_time: "19:30",
        location: "Pollack Hall",
        club_id: "music",
        tags: [EventTag.CULTURAL],
        image_url: "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&q=80&w=800",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "approved",
        approved_by: "system",
        approved_at: new Date().toISOString(),
        club: {
          id: "music",
          name: "Schulich School of Music",
          instagram_handle: "schulichmusic",
          logo_url: null,
          description: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        saved_by_users: []
      },
      {
        id: "rec-4",
        title: "OAP Open Air Pub",
        description: "Celebrate the end of classes with the biggest outdoor party of the semester! Burgers, beverages, and live music. (THIS IS DUMMY DATA TO BE REMOVED)",
        event_date: "2026-04-12",
        event_time: "12:00",
        location: "Three Bares Park",
        club_id: "eus",
        tags: [EventTag.SOCIAL],
        image_url: "https://images.unsplash.com/photo-1533174000243-ea8260b9ebf7?auto=format&fit=crop&q=80&w=800",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "approved",
        approved_by: "system",
        approved_at: new Date().toISOString(),
        club: {
          id: "eus",
          name: "Engineering Undergraduate Society",
          instagram_handle: "mcgilleus",
          logo_url: null,
          description: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        saved_by_users: []
      },
      {
        id: "rec-5",
        title: "Volleyball Intramural Finals",
        description: "Watch the top teams battle it out for the intramural championship! Come support your friends. (THIS IS DUMMY DATA TO BE REMOVED)",
        event_date: "2026-03-25",
        event_time: "17:00",
        location: "Currie Gymnasium",
        club_id: "athletics",
        tags: [EventTag.SPORTS, EventTag.SOCIAL],
        image_url: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?auto=format&fit=crop&q=80&w=800",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "approved",
        approved_by: "system",
        approved_at: new Date().toISOString(),
        club: {
          id: "athletics",
          name: "McGill Athletics",
          instagram_handle: "mcgillathletics",
          logo_url: null,
          description: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        saved_by_users: []
      },
      {
        id: "rec-6",
        title: "Tech Startup Networking Mixer",
        description: "Connect with founders from Montreal's top tech startups. Great opportunity to find summer internships! (THIS IS DUMMY DATA TO BE REMOVED)",
        event_date: "2026-03-28",
        event_time: "18:30",
        location: "Notman House",
        club_id: "desautels",
        tags: [EventTag.CAREER, EventTag.SOCIAL],
        image_url: "https://images.unsplash.com/photo-1515169067868-5387ec356754?auto=format&fit=crop&q=80&w=800",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "approved",
        approved_by: "system",
        approved_at: new Date().toISOString(),
        club: {
          id: "desautels",
          name: "Dobson Centre for Entrepreneurship",
          instagram_handle: "dobsoncentre",
          logo_url: null,
          description: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        saved_by_users: []
      },
      {
        id: "rec-7",
        title: "Board Game Night @ SSMU",
        description: "Take a break from studying and join us for a relaxed evening of board games and snacks. (THIS IS DUMMY DATA TO BE REMOVED)",
        event_date: "2026-04-02",
        event_time: "19:00",
        location: "SSMU Building, 3rd Floor",
        club_id: "ssmu",
        tags: [EventTag.SOCIAL, EventTag.WELLNESS],
        image_url: "https://images.unsplash.com/photo-1610890716171-6b1bb98ffaed?auto=format&fit=crop&q=80&w=800",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "approved",
        approved_by: "system",
        approved_at: new Date().toISOString(),
        club: {
          id: "ssmu",
          name: "Students' Society of McGill University",
          instagram_handle: "ssmu_aeum",
          logo_url: null,
          description: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        saved_by_users: []
      },
      {
        id: "rec-8",
        title: "Sustainable Thrift Pop-up",
        description: "Revamp your wardrobe sustainably! Shop pre-loved clothes donated by students. All proceeds go to charity. (THIS IS DUMMY DATA TO BE REMOVED)",
        event_date: "2026-03-22",
        event_time: "10:00",
        location: "Shatner Building Lobby",
        club_id: "environment",
        tags: [EventTag.SOCIAL, EventTag.CULTURAL],
        image_url: "https://images.unsplash.com/photo-1540221652346-e5dd6b50f3e7?auto=format&fit=crop&q=80&w=800",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "approved",
        approved_by: "system",
        approved_at: new Date().toISOString(),
        club: {
          id: "environment",
          name: "McGill Environment Students' Society",
          instagram_handle: "messmcgill",
          logo_url: null,
          description: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        saved_by_users: []
      },
      {
        id: "rec-9",
        title: "Alumni Resume Review Session",
        description: "Bring your resume and get 1-on-1 feedback from successful McGill alumni working in your target industry. (THIS IS DUMMY DATA TO BE REMOVED)",
        event_date: "2026-03-30",
        event_time: "16:00",
        location: "Brown Student Services Building",
        club_id: "career-services",
        tags: [EventTag.CAREER, EventTag.ACADEMIC],
        image_url: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&q=80&w=800",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "approved",
        approved_by: "system",
        approved_at: new Date().toISOString(),
        club: {
          id: "career-services",
          name: "McGill Career Planning Service",
          instagram_handle: "mcgillcaps",
          logo_url: null,
          description: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        saved_by_users: []
      },
      {
        id: "rec-10",
        title: "Robotics Design Team Kickoff",
        description: "Interested in building underwater rovers or mars rovers? Come to our informational session to learn how to join the team! (THIS IS DUMMY DATA TO BE REMOVED)",
        event_date: "2026-04-08",
        event_time: "18:00",
        location: "Macdonald Engineering Building",
        club_id: "robotics",
        tags: [EventTag.ACADEMIC, EventTag.CAREER],
        image_url: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&q=80&w=800",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: "approved",
        approved_by: "system",
        approved_at: new Date().toISOString(),
        club: {
          id: "robotics",
          name: "McGill Robotics",
          instagram_handle: "mcgillrobotics",
          logo_url: null,
          description: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        saved_by_users: []
      }
    ];
  };

  const fetchRecommendedEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      // DEMO MODE: using mock data for team demo instead of fetching from API
      // const res = await fetch("/api/recommendations");
      // if (!res.ok) {
      //   throw new Error("Failed to fetch recommendations");
      // }
      // const data = await res.json();
      // const fetchedEvents = Array.isArray(data.recommendations) ? data.recommendations : [];

      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network latency
      const fetchedEvents = generateDummyEvents();
      
      if (fetchedEvents.length === 0) {
        // Fallback to Popular events if no recommendations found
        onEmpty?.();
        return;
      }

      setEvents(fetchedEvents);
    } catch (err) {
      console.error("Error fetching recommended events:", err);
      // Trigger the fallback to Popular Events on any hard failure
      onEmpty?.();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendedEvents();
  }, []);

  if (loading && events.length === 0) {
    return (
      <div className="mb-12">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-foreground tracking-tight">Recommended For You</h2>
          <p className="text-muted-foreground mt-1">Based on your interests and saved events</p>
        </div>
        <Carousel className="w-full">
          <CarouselContent className="-ml-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <CarouselItem key={i} className="pl-4 basis-[85vw] sm:basis-1/2 lg:basis-1/3">
                <div className="h-[380px] w-full rounded-2xl bg-secondary/20 animate-pulse border border-border/40" />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-12 flex flex-col items-center justify-center py-10 text-center space-y-4 bg-card rounded-2xl border border-destructive/20 p-6">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchRecommendedEvents} variant="outline" size="sm" className="gap-2">
          <RefreshCcw className="h-3 w-3" />
          Try Again
        </Button>
      </div>
    );
  }

  if (events.length === 0) {
    return null; // The parent component (page.tsx) should catch this and fallback to PopularEventsSection via the onEmpty prop
  }

  return (
    <div className="mb-12">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-2">
             Recommended For You
             <span className="text-sm font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full">New</span>
          </h2>
          <p className="text-muted-foreground mt-1">Based on your interests and saved events</p>
        </div>
      
      <Carousel
        opts={{
          align: "start",
          loop: false,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-4">
          {events.map((event) => (
            <CarouselItem key={event.id} className="pl-4 basis-[85vw] sm:basis-1/2 lg:basis-1/3">
              <EventCard
                 event={event}
                 showSaveButton={!!user}
                 isSaved={savedEventIds.has(event.id)}
                 trackingSource="recommendation"
                 onClick={onEventClick ? () => onEventClick(event) : undefined}
               />
            </CarouselItem>
          ))}
        </CarouselContent>
        {/* Only show navigation arrows if there are more than 3 items on desktop */}
        {events.length > 3 && (
            <div className="hidden sm:block">
            <CarouselPrevious />
            <CarouselNext />
            </div>
        )}
      </Carousel>
    </div>
  );
}
