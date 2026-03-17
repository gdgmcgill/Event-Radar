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

  const hasFeatured = featured.length > 0;
  const totalSlides = hasFeatured ? featured.length + 1 : 1;

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

  // Static hero when no featured events (no carousel needed)
  if (isLoading || !hasFeatured) {
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

  // Featured events active — carousel with branded hero + featured slides
  return (
    <section className="relative w-full h-[85vh] min-h-[500px] overflow-hidden">
      <div ref={emblaRef} className="overflow-hidden h-full">
        <div className="flex h-full">
          {/* Branded hero as the first slide */}
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
          {/* Featured event slides */}
          {featured.map((f: FeaturedEvent) => (
            <HeroSlide
              key={f.id}
              title={f.event.title}
              description={f.event.description || ""}
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
        count={totalSlides}
        selected={selectedIndex}
        onSelect={scrollTo}
      />
    </section>
  );
}
