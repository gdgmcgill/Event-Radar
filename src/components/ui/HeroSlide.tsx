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
    <div className="relative w-full h-[85vh] min-h-[500px] flex-[0_0_100%]">
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000"
        style={{ backgroundImage: `url("${imageUrl}")` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black from-0% via-black/80 via-[15%] via-black/50 via-[50%] to-black/20 to-100%" />
      <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-background from-10% via-background/40 via-50% to-transparent" />

      <div className="absolute bottom-0 left-0 p-6 md:p-10 lg:p-12 w-full lg:w-3/4 pb-28 md:pb-36">
        <span className="inline-block px-5 py-2 bg-white/20 dark:bg-white/10 backdrop-blur-xl text-white text-xs font-black uppercase tracking-[0.2em] rounded-full mb-8 border border-white/30 dark:border-white/15 shadow-xl [text-shadow:0_1px_3px_rgba(0,0,0,0.3)]">
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
            className="px-8 md:px-10 py-4 md:py-5 bg-primary text-white text-lg md:text-xl font-bold rounded-2xl hover:brightness-110 transition-all shadow-lg shadow-primary/20 flex items-center gap-3 cursor-pointer"
          >
            {primaryIcon || <UserCheck className="h-5 w-5 md:h-6 md:w-6" />}
            {primaryLabel}
          </button>
          <button
            onClick={onSecondary}
            className="px-6 md:px-8 py-4 md:py-5 bg-white/20 dark:bg-white/10 backdrop-blur-xl text-white font-bold border border-white/30 dark:border-white/15 rounded-2xl hover:bg-white/30 dark:hover:bg-white/20 transition-all flex items-center gap-3 cursor-pointer shadow-lg"
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
