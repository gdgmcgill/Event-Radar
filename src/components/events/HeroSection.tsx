"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { type Event } from "@/types";
import { UserCheck, Info } from "lucide-react";

export function HeroSection() {
  const router = useRouter();
  const [featuredEvent, setFeaturedEvent] = useState<Event | null>(null);

  useEffect(() => {
    const fetchFeatured = async () => {
      try {
        const res = await fetch("/api/events/popular?sort=popularity&limit=1");
        if (!res.ok) return;
        const data = await res.json();
        if (data.events?.[0]) setFeaturedEvent(data.events[0]);
      } catch {
        // Silently fail — hero will show fallback
      }
    };
    fetchFeatured();
  }, []);

  const title = featuredEvent?.title || "McGill Annual Winter Gala 2024";
  const description =
    featuredEvent?.description ||
    "Experience the most prestigious night on campus. Join us at the University Centre for an unforgettable evening of elegance and celebration.";
  const imageUrl =
    featuredEvent?.image_url ||
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=2874&auto=format&fit=crop";
  const eventId = featuredEvent?.id;

  return (
    <section className="relative w-full h-[85vh] min-h-[500px] overflow-hidden group">
      {/* Background Image — using CSS background for external/fallback URLs */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 group-hover:scale-105"
        style={{ backgroundImage: `url("${imageUrl}")` }}
      />

      {/* Gradient Overlay — always dark so white text stays readable, fades to page bg at bottom */}
      <div className="absolute inset-0 bg-gradient-to-t from-black from-0% via-black/80 via-[15%] via-black/50 via-[50%] to-black/20 to-100%" />
      {/* Thin blend strip at bottom to transition into page background */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 p-6 md:p-10 lg:p-12 w-full lg:w-3/4 pb-28 md:pb-36">
        <span className="inline-block px-5 py-2 bg-white/10 backdrop-blur-xl text-white text-xs font-black uppercase tracking-[0.2em] rounded-full mb-8 border border-white/20 shadow-xl">
          Featured Experience
        </span>

        <h2 className="text-white text-5xl sm:text-6xl lg:text-8xl font-black leading-[0.9] tracking-tighter mb-8 drop-shadow-2xl">
          {title}
        </h2>

        <p className="text-white/90 text-lg lg:text-2xl font-medium max-w-2xl mb-10 leading-relaxed drop-shadow-lg line-clamp-3">
          {description}
        </p>

        <div className="flex items-center gap-5">
          <button
            onClick={() => {
              if (eventId) router.push(`/events/${eventId}`);
            }}
            className="px-8 md:px-10 py-4 md:py-5 bg-primary text-white text-lg md:text-xl font-bold rounded-2xl hover:brightness-110 transition-all shadow-2xl shadow-primary/40 flex items-center gap-3 cursor-pointer"
          >
            <UserCheck className="h-5 w-5 md:h-6 md:w-6" />
            Register Now
          </button>
          <button
            onClick={() => {
              if (eventId) router.push(`/events/${eventId}`);
            }}
            className="px-6 md:px-8 py-4 md:py-5 bg-white/10 backdrop-blur-md text-white font-bold border border-white/20 rounded-2xl hover:bg-white/20 transition-all flex items-center gap-3 cursor-pointer"
          >
            <Info className="h-5 w-5 md:h-6 md:w-6" />
            More Info
          </button>
        </div>
      </div>
    </section>
  );
}
