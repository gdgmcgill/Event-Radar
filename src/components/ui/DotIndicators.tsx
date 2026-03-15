"use client";

interface DotIndicatorsProps {
  count: number;
  selected: number;
  onSelect: (index: number) => void;
}

export function DotIndicators({ count, selected, onSelect }: DotIndicatorsProps) {
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
