"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { Building2 } from "lucide-react";
import { useFeaturedClubs } from "@/hooks/useFeaturedClubs";
import { HeroSlide } from "@/components/ui/HeroSlide";
import { DotIndicators } from "@/components/ui/DotIndicators";
import type { FeaturedClub } from "@/types";

export function ClubsHeroSection() {
  const router = useRouter();
  const { featured, isLoading } = useFeaturedClubs();
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

  if (isLoading || featured.length === 0) {
    return (
      <section className="relative w-full h-[85vh] min-h-[500px] overflow-hidden group">
        <HeroSlide
          title="Find Your Community"
          description="Discover student clubs and organizations at McGill. Join a community that matches your passions."
          imageUrl="/club_hero.jpeg"
          badge="Clubs Directory"
          primaryLabel="Explore Clubs"
          primaryIcon={<Building2 className="h-5 w-5 md:h-6 md:w-6" />}
          onPrimary={() => {
            document
              .getElementById("clubs-feed")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
          secondaryLabel="Learn More"
          onSecondary={() => router.push("/about")}
        />
      </section>
    );
  }

  if (featured.length === 1) {
    const f = featured[0];
    return (
      <section className="relative w-full h-[85vh] min-h-[500px] overflow-hidden group">
        <HeroSlide
          title={f.club.name}
          description={f.club.description ?? `Discover ${f.club.name} on UNI-VERSE`}
          imageUrl={f.club.logo_url || "/club_hero.jpeg"}
          badge={f.sponsor_name ? `Sponsored by ${f.sponsor_name}` : "Featured Club"}
          primaryLabel="View Club"
          primaryIcon={<Building2 className="h-5 w-5 md:h-6 md:w-6" />}
          onPrimary={() => router.push(`/clubs/${f.club.id}`)}
          secondaryLabel="Explore Clubs"
          onSecondary={() => {
            document
              .getElementById("clubs-feed")
              ?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      </section>
    );
  }

  return (
    <section className="relative w-full h-[85vh] min-h-[500px] overflow-hidden">
      <div ref={emblaRef} className="overflow-hidden h-full">
        <div className="flex h-full">
          {featured.map((f: FeaturedClub) => (
            <HeroSlide
              key={f.id}
              title={f.club.name}
              description={f.club.description ?? `Discover ${f.club.name} on UNI-VERSE`}
              imageUrl={f.club.logo_url || "/club_hero.jpeg"}
              badge={f.sponsor_name ? `Sponsored by ${f.sponsor_name}` : "Featured Club"}
              primaryLabel="View Club"
              primaryIcon={<Building2 className="h-5 w-5 md:h-6 md:w-6" />}
              onPrimary={() => router.push(`/clubs/${f.club.id}`)}
              secondaryLabel="Explore Clubs"
              onSecondary={() => {
                document
                  .getElementById("clubs-feed")
                  ?.scrollIntoView({ behavior: "smooth" });
              }}
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
