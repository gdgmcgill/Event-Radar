"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { useFeaturedEvents } from "@/hooks/useFeaturedEvents";
import { HERO_FALLBACK_IMAGE } from "@/lib/constants";
import type { FeaturedEvent } from "@/types";
import { HeroSlide } from "@/components/ui/HeroSlide";
import { DotIndicators } from "@/components/ui/DotIndicators";

export function HeroSection() {
  const router = useRouter();
  const { featured, isLoading } = useFeaturedEvents();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [
    Autoplay({ delay: 6000, stopOnInteraction: false, stopOnMouseEnter: true }),
  ]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi]
  );

  // Branded fallback when no featured events
  if (isLoading || featured.length === 0) {
    return (
      <section className="relative w-full h-[85vh] min-h-[500px] overflow-hidden group">
        <HeroSlide
          title="Discover What's Happening on Campus"
          description="Your one-stop hub for McGill events. Find clubs, workshops, parties, career fairs, and everything in between."
          imageUrl={HERO_FALLBACK_IMAGE}
          badge="UNI-VERSE"
          primaryLabel="Explore Events"
          onPrimary={() => {
            document
              .getElementById("discovery-feed")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
          secondaryLabel="Learn More"
          onSecondary={() => router.push("/about")}
        />
      </section>
    );
  }

  // Single featured event — no carousel needed
  if (featured.length === 1) {
    const f = featured[0];
    return (
      <section className="relative w-full h-[85vh] min-h-[500px] overflow-hidden group">
        <HeroSlide
          title={f.event.title}
          description={f.event.description}
          imageUrl={f.event.image_url || HERO_FALLBACK_IMAGE}
          badge={f.sponsor_name ? `Sponsored by ${f.sponsor_name}` : "Sponsored"}
          primaryLabel="Register Now"
          onPrimary={() => router.push(`/events/${f.event.id}`)}
          secondaryLabel="More Info"
          onSecondary={() => router.push(`/events/${f.event.id}`)}
        />
      </section>
    );
  }

  // Multiple featured events — carousel
  return (
    <section className="relative w-full h-[85vh] min-h-[500px] overflow-hidden">
      <div ref={emblaRef} className="overflow-hidden h-full">
        <div className="flex h-full">
          {featured.map((f: FeaturedEvent) => (
            <HeroSlide
              key={f.id}
              title={f.event.title}
              description={f.event.description}
              imageUrl={f.event.image_url || HERO_FALLBACK_IMAGE}
              badge={
                f.sponsor_name
                  ? `Sponsored by ${f.sponsor_name}`
                  : "Sponsored"
              }
              primaryLabel="Register Now"
              onPrimary={() => router.push(`/events/${f.event.id}`)}
              secondaryLabel="More Info"
              onSecondary={() => router.push(`/events/${f.event.id}`)}
            />
          ))}
        </div>
      </div>
      <DotIndicators
        count={featured.length}
        selected={selectedIndex}
        onSelect={scrollTo}
      />
    </section>
  );
}
