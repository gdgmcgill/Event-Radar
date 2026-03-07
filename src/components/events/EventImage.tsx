"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface EventImageProps {
  imageUrl: string | null;
  clubLogoUrl?: string | null;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fill?: boolean;
  width?: number;
  height?: number;
}

/**
 * EventImage component with three-tier fallback hierarchy:
 * 1. Event image_url
 * 2. Club logo_url
 * 3. Branded Uni-Verse placeholder
 * 
 * Handles broken image URLs gracefully with onError handling
 * Uses Next.js Image component for optimization
 */
export function EventImage({
  imageUrl,
  clubLogoUrl,
  alt,
  className,
  sizes,
  priority = false,
  fill = true,
  width,
  height,
}: EventImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string | null>(
    imageUrl || clubLogoUrl || "/placeholder-event.png"
  );
  const [fallbackLevel, setFallbackLevel] = useState<"event" | "club" | "default">(
    imageUrl ? "event" : clubLogoUrl ? "club" : "default"
  );

  const handleError = () => {
    if (fallbackLevel === "event" && clubLogoUrl) {
      // First fallback: try club logo
      setCurrentSrc(clubLogoUrl);
      setFallbackLevel("club");
    } else if (fallbackLevel === "club" || (fallbackLevel === "event" && !clubLogoUrl)) {
      // Second fallback: use default placeholder
      setCurrentSrc("/placeholder-event.png");
      setFallbackLevel("default");
    }
    // If we're already at default, no further fallback
  };

  // For default placeholder, we can use regular img for SVG to avoid warnings
  if (fallbackLevel === "default") {
    return (
      <div className={cn("relative w-full h-full", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/placeholder-event.png"
          alt={alt}
          className={fill ? "absolute inset-0 w-full h-full object-cover" : ""}
          style={!fill && width && height ? { width, height } : undefined}
        />
      </div>
    );
  }

  // For event images and club logos, use Next.js Image component
  if (fill) {
    return (
      <Image
        src={currentSrc || "/placeholder-event.png"}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        className={cn("object-cover", className)}
        onError={handleError}
      />
    );
  }

  // Fixed dimensions mode
  return (
    <Image
      src={currentSrc || "/placeholder-event.png"}
      alt={alt}
      width={width || 400}
      height={height || 300}
      sizes={sizes}
      priority={priority}
      className={className}
      onError={handleError}
    />
  );
}
