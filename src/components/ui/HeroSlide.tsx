"use client";

import { type ReactNode } from "react";
import { UserCheck, Info, ChevronDown } from "lucide-react";

interface HeroSlideProps {
  title: string;
  description: string;
  imageUrl: string;
  badge: string;
  onPrimary?: () => void;
  primaryLabel: string;
  primaryIcon?: ReactNode;
  onSecondary?: () => void;
  secondaryLabel: string;
}

export function HeroSlide({
  title,
  description,
  imageUrl,
  badge,
  onPrimary,
  primaryLabel,
  primaryIcon,
  onSecondary,
  secondaryLabel,
}: HeroSlideProps) {
  return (
    <div className="relative w-full min-h-[500px] h-[clamp(500px,85vh,900px)] flex-[0_0_100%] flex items-end overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url("${imageUrl}")` }}
      />
      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-t from-black from-0% via-black/70 via-30% to-black/20 to-100%" />
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background via-background/60 to-transparent" />

      {/* Content - uses flex parent alignment instead of absolute positioning */}
      <div className="relative z-10 w-full lg:w-3/4 px-4 sm:px-6 md:px-10 lg:px-12 pt-16 pb-20 sm:pb-28 md:pb-36">
        <span className="inline-block px-4 py-1.5 bg-white/20 backdrop-blur-xl text-white text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] rounded-full mb-4 sm:mb-6 border border-white/30 shadow-xl">
          {badge}
        </span>

        <h2 className="text-white text-[clamp(1.75rem,5vw,4.5rem)] font-black leading-[0.95] tracking-tight mb-4 sm:mb-5 drop-shadow-2xl">
          {title}
        </h2>

        <p className="text-white/90 text-sm sm:text-base lg:text-lg font-medium max-w-2xl mb-5 sm:mb-6 leading-relaxed drop-shadow-lg line-clamp-2 sm:line-clamp-3">
          {description}
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4">
          <button
            onClick={onPrimary}
            className="w-full sm:w-auto px-5 sm:px-7 py-3 sm:py-3.5 bg-primary text-white text-sm sm:text-base font-bold rounded-xl sm:rounded-2xl hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2.5 cursor-pointer"
          >
            {primaryIcon || <UserCheck className="h-4 w-4 sm:h-5 sm:w-5" />}
            {primaryLabel}
          </button>
          <button
            onClick={onSecondary}
            className="w-full sm:w-auto px-5 sm:px-7 py-3 sm:py-3.5 bg-white/20 backdrop-blur-xl text-white font-bold border border-white/30 rounded-xl sm:rounded-2xl hover:bg-white/30 transition-all flex items-center justify-center gap-2.5 cursor-pointer shadow-lg"
          >
            {secondaryLabel === "More Info" ? (
              <Info className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <ChevronDown className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
            {secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
