"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { UserCheck, Info, ChevronDown } from "lucide-react";
import { useFeaturedEvents } from "@/hooks/useFeaturedEvents";
import { HERO_FALLBACK_IMAGE } from "@/lib/constants";
import type { FeaturedEvent } from "@/types";

function HeroSlide({
  title,
  description,
  imageUrl,
  badge,
  onPrimary,
  primaryLabel,
  onSecondary,
  secondaryLabel,
}: {
  title: string;
  description: string;
  imageUrl: string;
  badge: string;
  onPrimary?: () => void;
  primaryLabel: string;
  onSecondary?: () => void;
  secondaryLabel: string;
}) {
  return (
    <div className="relative w-full h-[85vh] min-h-[500px] flex-[0_0_100%]">
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000"
        style={{ backgroundImage: `url("${imageUrl}")` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black from-0% via-black/80 via-[15%] via-black/50 via-[50%] to-black/20 to-100%" />
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background to-transparent" />

      <div className="absolute bottom-0 left-0 p-6 md:p-10 lg:p-12 w-full lg:w-3/4 pb-28 md:pb-36">
        <span className="inline-block px-5 py-2 bg-white/10 backdrop-blur-xl text-white text-xs font-black uppercase tracking-[0.2em] rounded-full mb-8 border border-white/20 shadow-xl">
          {badge}
        </span>

        <h2 className="text-white text-5xl sm:text-6xl lg:text-8xl font-black leading-[0.9] tracking-tighter mb-8 drop-shadow-2xl">
          {title}
        </h2>

        <p className="text-white/90 text-lg lg:text-2xl font-medium max-w-2xl mb-10 leading-relaxed drop-shadow-lg line-clamp-3">
          {description}
        </p>

        <div className="flex items-center gap-5">
          <button
            onClick={onPrimary}
            className="px-8 md:px-10 py-4 md:py-5 bg-primary text-white text-lg md:text-xl font-bold rounded-2xl hover:brightness-110 transition-all shadow-2xl shadow-primary/40 flex items-center gap-3 cursor-pointer"
          >
            <UserCheck className="h-5 w-5 md:h-6 md:w-6" />
            {primaryLabel}
          </button>
          <button
            onClick={onSecondary}
            className="px-6 md:px-8 py-4 md:py-5 bg-white/10 backdrop-blur-md text-white font-bold border border-white/20 rounded-2xl hover:bg-white/20 transition-all flex items-center gap-3 cursor-pointer"
          >
            {secondaryLabel === "More Info" ? (
              <Info className="h-5 w-5 md:h-6 md:w-6" />
            ) : (
              <ChevronDown className="h-5 w-5 md:h-6 md:w-6" />
            )}
            {secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function DotIndicators({
  count,
  selected,
  onSelect,
}: {
  count: number;
  selected: number;
  onSelect: (index: number) => void;
}) {
  if (count <= 1) return null;

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          onClick={() => onSelect(i)}
          className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
            i === selected
              ? "w-8 bg-white"
              : "w-2 bg-white/40 hover:bg-white/60"
          }`}
          aria-label={`Go to slide ${i + 1}`}
        />
      ))}
    </div>
  );
}

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
          badge="Uni-Verse"
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
