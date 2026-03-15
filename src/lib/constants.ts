/**
 * Constants for UNI-VERSE application
 */

import { EventTag } from "@/types";

export const EVENT_TAGS: EventTag[] = [
  EventTag.ACADEMIC,
  EventTag.SOCIAL,
  EventTag.SPORTS,
  EventTag.CAREER,
  EventTag.CULTURAL,
  EventTag.WELLNESS,
  EventTag.MUSIC,
  EventTag.TECH,
  EventTag.FOOD,
  EventTag.VOLUNTEER,
  EventTag.ARTS,
  EventTag.NETWORKING,
];

export const EVENT_CATEGORIES = {
  [EventTag.ACADEMIC]: {
    label: "Academic",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300",
    borderColor: "border-blue-400 dark:border-blue-500",
    selectedBg: "bg-blue-50 dark:bg-blue-950/40",
    checkColor: "bg-blue-600 text-white",
    icon: "GraduationCap",
    baseColor: "#3b82f6", // tailwind blue-500
    badgeTheme: "bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/25 dark:ring-blue-400/30",
  },
  [EventTag.SOCIAL]: {
    label: "Social",
    color: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300",
    borderColor: "border-pink-400 dark:border-pink-500",
    selectedBg: "bg-pink-50 dark:bg-pink-950/40",
    checkColor: "bg-pink-600 text-white",
    icon: "Users",
    baseColor: "#ec4899", // tailwind pink-500
    badgeTheme: "bg-gradient-to-r from-pink-500/10 to-rose-500/10 border-pink-500/30 text-pink-700 dark:text-pink-300 ring-2 ring-pink-500/25 dark:ring-pink-400/30",
  },
  [EventTag.SPORTS]: {
    label: "Sports",
    color: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
    borderColor: "border-green-400 dark:border-green-500",
    selectedBg: "bg-green-50 dark:bg-green-950/40",
    checkColor: "bg-green-600 text-white",
    icon: "Trophy",
    baseColor: "#22c55e", // tailwind green-500
    badgeTheme: "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/30 text-green-700 dark:text-green-300 ring-2 ring-green-500/25 dark:ring-green-400/30",
  },
  [EventTag.CAREER]: {
    label: "Career",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
    borderColor: "border-purple-400 dark:border-purple-500",
    selectedBg: "bg-purple-50 dark:bg-purple-950/40",
    checkColor: "bg-purple-600 text-white",
    icon: "Briefcase",
    baseColor: "#a855f7", // tailwind purple-500
    badgeTheme: "bg-gradient-to-r from-purple-500/10 to-fuchsia-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300 ring-2 ring-purple-500/25 dark:ring-purple-400/30",
  },
  [EventTag.CULTURAL]: {
    label: "Cultural",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
    borderColor: "border-orange-400 dark:border-orange-500",
    selectedBg: "bg-orange-50 dark:bg-orange-950/40",
    checkColor: "bg-orange-600 text-white",
    icon: "Palette",
    baseColor: "#f97316", // tailwind orange-500
    badgeTheme: "bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-orange-500/30 text-orange-700 dark:text-orange-300 ring-2 ring-orange-500/25 dark:ring-orange-400/30",
  },
  [EventTag.WELLNESS]: {
    label: "Wellness",
    color: "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300",
    borderColor: "border-teal-400 dark:border-teal-500",
    selectedBg: "bg-teal-50 dark:bg-teal-950/40",
    checkColor: "bg-teal-600 text-white",
    icon: "Heart",
    baseColor: "#14b8a6", // tailwind teal-500
    badgeTheme: "bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border-teal-500/30 text-teal-700 dark:text-teal-300 ring-2 ring-teal-500/25 dark:ring-teal-400/30",
  },
  [EventTag.MUSIC]: {
    label: "Music",
    color: "bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300",
    borderColor: "border-rose-400 dark:border-rose-500",
    selectedBg: "bg-rose-50 dark:bg-rose-950/40",
    checkColor: "bg-rose-600 text-white",
    icon: "Music",
    baseColor: "#e11d48", // tailwind rose-600
    badgeTheme: "bg-gradient-to-r from-rose-500/10 to-pink-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/25 dark:ring-rose-400/30",
  },
  [EventTag.TECH]: {
    label: "Tech",
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
    borderColor: "border-indigo-400 dark:border-indigo-500",
    selectedBg: "bg-indigo-50 dark:bg-indigo-950/40",
    checkColor: "bg-indigo-600 text-white",
    icon: "Cpu",
    baseColor: "#6366f1", // tailwind indigo-500
    badgeTheme: "bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/25 dark:ring-indigo-400/30",
  },
  [EventTag.FOOD]: {
    label: "Food & Drink",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
    borderColor: "border-amber-400 dark:border-amber-500",
    selectedBg: "bg-amber-50 dark:bg-amber-950/40",
    checkColor: "bg-amber-600 text-white",
    icon: "UtensilsCrossed",
    baseColor: "#f59e0b", // tailwind amber-500
    badgeTheme: "bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/25 dark:ring-amber-400/30",
  },
  [EventTag.VOLUNTEER]: {
    label: "Volunteer",
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
    borderColor: "border-emerald-400 dark:border-emerald-500",
    selectedBg: "bg-emerald-50 dark:bg-emerald-950/40",
    checkColor: "bg-emerald-600 text-white",
    icon: "HandHeart",
    baseColor: "#10b981", // tailwind emerald-500
    badgeTheme: "bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/25 dark:ring-emerald-400/30",
  },
  [EventTag.ARTS]: {
    label: "Arts",
    color: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/50 dark:text-fuchsia-300",
    borderColor: "border-fuchsia-400 dark:border-fuchsia-500",
    selectedBg: "bg-fuchsia-50 dark:bg-fuchsia-950/40",
    checkColor: "bg-fuchsia-600 text-white",
    icon: "Paintbrush",
    baseColor: "#d946ef", // tailwind fuchsia-500
    badgeTheme: "bg-gradient-to-r from-fuchsia-500/10 to-pink-500/10 border-fuchsia-500/30 text-fuchsia-700 dark:text-fuchsia-300 ring-2 ring-fuchsia-500/25 dark:ring-fuchsia-400/30",
  },
  [EventTag.NETWORKING]: {
    label: "Networking",
    color: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300",
    borderColor: "border-sky-400 dark:border-sky-500",
    selectedBg: "bg-sky-50 dark:bg-sky-950/40",
    checkColor: "bg-sky-600 text-white",
    icon: "Handshake",
    baseColor: "#0ea5e9", // tailwind sky-500
    badgeTheme: "bg-gradient-to-r from-sky-500/10 to-blue-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/25 dark:ring-sky-400/30",
  },
} as const;

/**
 * Quick filter tags for the homepage filter bar.
 * These map to raw DB tag strings and provide more granular filtering
 * beyond the 6 broad EventTag categories.
 */
export interface QuickFilter {
  label: string;
  tag: string; // raw DB tag string
  icon: string; // lucide icon name
  baseColor: string;
  badgeTheme: string;
}

export const QUICK_FILTERS: QuickFilter[] = [
  {
    label: "Hackathon",
    tag: "hackathon",
    icon: "Code",
    baseColor: "#6366f1", // indigo
    badgeTheme: "bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/25 dark:ring-indigo-400/30",
  },
  {
    label: "Case Comp",
    tag: "competition",
    icon: "Award",
    baseColor: "#f59e0b", // amber
    badgeTheme: "bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/25 dark:ring-amber-400/30",
  },
  {
    label: "Guest Speaker",
    tag: "guest_speaker",
    icon: "Mic",
    baseColor: "#8b5cf6", // violet
    badgeTheme: "bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/30 text-violet-700 dark:text-violet-300 ring-2 ring-violet-500/25 dark:ring-violet-400/30",
  },
  {
    label: "Networking",
    tag: "networking",
    icon: "Handshake",
    baseColor: "#0ea5e9", // sky
    badgeTheme: "bg-gradient-to-r from-sky-500/10 to-blue-500/10 border-sky-500/30 text-sky-700 dark:text-sky-300 ring-2 ring-sky-500/25 dark:ring-sky-400/30",
  },
  {
    label: "Free Food",
    tag: "free_food",
    icon: "UtensilsCrossed",
    baseColor: "#ef4444", // red
    badgeTheme: "bg-gradient-to-r from-red-500/10 to-rose-500/10 border-red-500/30 text-red-700 dark:text-red-300 ring-2 ring-red-500/25 dark:ring-red-400/30",
  },
  {
    label: "Workshop",
    tag: "workshop",
    icon: "Wrench",
    baseColor: "#10b981", // emerald
    badgeTheme: "bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/25 dark:ring-emerald-400/30",
  },
  {
    label: "Party",
    tag: "party",
    icon: "PartyPopper",
    baseColor: "#d946ef", // fuchsia
    badgeTheme: "bg-gradient-to-r from-fuchsia-500/10 to-pink-500/10 border-fuchsia-500/30 text-fuchsia-700 dark:text-fuchsia-300 ring-2 ring-fuchsia-500/25 dark:ring-fuchsia-400/30",
  },
  {
    label: "Music",
    tag: "music",
    icon: "Music",
    baseColor: "#e11d48", // rose
    badgeTheme: "bg-gradient-to-r from-rose-500/10 to-pink-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/25 dark:ring-rose-400/30",
  },
  {
    label: "Fitness",
    tag: "fitness",
    icon: "Dumbbell",
    baseColor: "#84cc16", // lime
    badgeTheme: "bg-gradient-to-r from-lime-500/10 to-green-500/10 border-lime-500/30 text-lime-700 dark:text-lime-300 ring-2 ring-lime-500/25 dark:ring-lime-400/30",
  },
  {
    label: "Info Session",
    tag: "info_session",
    icon: "Info",
    baseColor: "#06b6d4", // cyan
    badgeTheme: "bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300 ring-2 ring-cyan-500/25 dark:ring-cyan-400/30",
  },
];

/**
 * Lookup for quick-filter tag metadata, keyed by tag string.
 * Same shape as EVENT_CATEGORIES so InterestTagSelector can render them uniformly.
 * Only includes quick-filter tags NOT already in EventTag.
 */
export const QUICK_FILTER_CATEGORIES: Record<string, {
  label: string;
  icon: string;
  baseColor: string;
  badgeTheme: string;
  borderColor: string;
  selectedBg: string;
  checkColor: string;
  color: string;
}> = {
  hackathon: {
    label: "Hackathon",
    icon: "Code",
    baseColor: "#6366f1",
    badgeTheme: "bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border-indigo-500/30 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/25 dark:ring-indigo-400/30",
    borderColor: "border-indigo-400 dark:border-indigo-500",
    selectedBg: "bg-indigo-50 dark:bg-indigo-950/40",
    checkColor: "bg-indigo-600 text-white",
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300",
  },
  competition: {
    label: "Case Comp",
    icon: "Award",
    baseColor: "#f59e0b",
    badgeTheme: "bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/25 dark:ring-amber-400/30",
    borderColor: "border-amber-400 dark:border-amber-500",
    selectedBg: "bg-amber-50 dark:bg-amber-950/40",
    checkColor: "bg-amber-600 text-white",
    color: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300",
  },
  guest_speaker: {
    label: "Guest Speaker",
    icon: "Mic",
    baseColor: "#8b5cf6",
    badgeTheme: "bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-500/30 text-violet-700 dark:text-violet-300 ring-2 ring-violet-500/25 dark:ring-violet-400/30",
    borderColor: "border-violet-400 dark:border-violet-500",
    selectedBg: "bg-violet-50 dark:bg-violet-950/40",
    checkColor: "bg-violet-600 text-white",
    color: "bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300",
  },
  free_food: {
    label: "Free Food",
    icon: "UtensilsCrossed",
    baseColor: "#ef4444",
    badgeTheme: "bg-gradient-to-r from-red-500/10 to-rose-500/10 border-red-500/30 text-red-700 dark:text-red-300 ring-2 ring-red-500/25 dark:ring-red-400/30",
    borderColor: "border-red-400 dark:border-red-500",
    selectedBg: "bg-red-50 dark:bg-red-950/40",
    checkColor: "bg-red-600 text-white",
    color: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300",
  },
  workshop: {
    label: "Workshop",
    icon: "Wrench",
    baseColor: "#10b981",
    badgeTheme: "bg-gradient-to-r from-emerald-500/10 to-green-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500/25 dark:ring-emerald-400/30",
    borderColor: "border-emerald-400 dark:border-emerald-500",
    selectedBg: "bg-emerald-50 dark:bg-emerald-950/40",
    checkColor: "bg-emerald-600 text-white",
    color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  party: {
    label: "Party",
    icon: "PartyPopper",
    baseColor: "#d946ef",
    badgeTheme: "bg-gradient-to-r from-fuchsia-500/10 to-pink-500/10 border-fuchsia-500/30 text-fuchsia-700 dark:text-fuchsia-300 ring-2 ring-fuchsia-500/25 dark:ring-fuchsia-400/30",
    borderColor: "border-fuchsia-400 dark:border-fuchsia-500",
    selectedBg: "bg-fuchsia-50 dark:bg-fuchsia-950/40",
    checkColor: "bg-fuchsia-600 text-white",
    color: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/50 dark:text-fuchsia-300",
  },
  fitness: {
    label: "Fitness",
    icon: "Dumbbell",
    baseColor: "#84cc16",
    badgeTheme: "bg-gradient-to-r from-lime-500/10 to-green-500/10 border-lime-500/30 text-lime-700 dark:text-lime-300 ring-2 ring-lime-500/25 dark:ring-lime-400/30",
    borderColor: "border-lime-400 dark:border-lime-500",
    selectedBg: "bg-lime-50 dark:bg-lime-950/40",
    checkColor: "bg-lime-600 text-white",
    color: "bg-lime-100 text-lime-800 dark:bg-lime-900/50 dark:text-lime-300",
  },
  info_session: {
    label: "Info Session",
    icon: "Info",
    baseColor: "#06b6d4",
    badgeTheme: "bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border-cyan-500/30 text-cyan-700 dark:text-cyan-300 ring-2 ring-cyan-500/25 dark:ring-cyan-400/30",
    borderColor: "border-cyan-400 dark:border-cyan-500",
    selectedBg: "bg-cyan-50 dark:bg-cyan-950/40",
    checkColor: "bg-cyan-600 text-white",
    color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300",
  },
};

/**
 * All tags that are valid as user interest selections.
 * Combines broad EventTag values with granular quick-filter tags.
 */
export const VALID_INTEREST_TAGS: string[] = [
  ...Object.values(EventTag),
  ...Object.keys(QUICK_FILTER_CATEGORIES),
];

/**
 * Maps granular quick-filter tags to their parent EventTag.
 * Used by the recommendation scoring engine for partial affinity matching.
 * A user interested in "hackathon" gets partial affinity (0.5x) for "tech" events.
 */
export const TAG_HIERARCHY: Record<string, string> = {
  hackathon: EventTag.TECH,
  competition: EventTag.CAREER,
  guest_speaker: EventTag.ACADEMIC,
  free_food: EventTag.FOOD,
  workshop: EventTag.TECH,
  party: EventTag.SOCIAL,
  fitness: EventTag.SPORTS,
  info_session: EventTag.CAREER,
};

/**
 * Reverse mapping: parent EventTag → child granular tags.
 * Auto-computed from TAG_HIERARCHY.
 */
export const TAG_CHILDREN: Record<string, string[]> = Object.entries(TAG_HIERARCHY).reduce(
  (acc, [child, parent]) => {
    if (!acc[parent]) acc[parent] = [];
    acc[parent].push(child);
    return acc;
  },
  {} as Record<string, string[]>
);

/**
 * Quick-filter tags that are not already covered by EventTag.
 * Used to render the "More Interests" section in InterestTagSelector.
 */
export const EXTRA_INTEREST_TAGS: string[] = Object.keys(QUICK_FILTER_CATEGORIES);

export const PRONOUNS = [
  "he/him",
  "she/her",
  "they/them",
  "he/they",
  "she/they",
  "any pronouns",
  "prefer not to say",
] as const;

export const YEARS = [
  "U0",
  "U1",
  "U2",
  "U3",
  "U4",
  "Graduate",
  "Alumni",
] as const;

export const FACULTIES = [
  "Arts",
  "Science",
  "Engineering",
  "Management",
  "Medicine",
  "Law",
  "Education",
  "Music",
  "Dentistry",
  "Agriculture & Environmental Sciences",
  "Continuing Studies",
] as const;

export const API_ENDPOINTS = {
  ADMIN_CALCULATE_POPULARITY: "/api/admin/calculate-popularity",
  // A/B Testing endpoints
  ADMIN_EXPERIMENTS: "/api/admin/experiments",
  ADMIN_EXPERIMENT_DETAIL: (id: string) => `/api/admin/experiments/${id}`,
  ADMIN_EXPERIMENT_RESULTS: (id: string) => `/api/admin/experiments/${id}/results`,
  // Featured events
  FEATURED_EVENTS: "/api/events/featured",
  ADMIN_FEATURED: "/api/admin/featured",
  ADMIN_FEATURED_DETAIL: (id: string) => `/api/admin/featured/${id}`,
};

export const HERO_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1576495199011-eb94736d05d6?q=80&w=2872&auto=format&fit=crop";

export const FEATURED_DURATION_PRESETS = [
  { label: "3 days", days: 3 },
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
] as const;

