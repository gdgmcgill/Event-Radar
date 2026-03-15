"use client";

interface ClubInitialsProps {
  name: string;
  className?: string;
}

/**
 * Renders the first 2 initials of a club name as a styled fallback when no logo exists.
 * Uses the club name to deterministically pick a color from a palette.
 */
export function ClubInitials({ name, className = "" }: ClubInitialsProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  // Deterministic color from name
  const colors = [
    "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    "bg-violet-500/15 text-violet-700 dark:text-violet-400",
    "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
    "bg-pink-500/15 text-pink-700 dark:text-pink-400",
    "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  ];
  const hash = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const color = colors[hash % colors.length];

  return (
    <div className={`flex items-center justify-center font-bold select-none ${color} ${className}`}>
      {initials || "?"}
    </div>
  );
}
