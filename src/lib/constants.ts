/**
 * Constants for Uni-Verse application
 */

import { EventTag } from "@/types";

export const EVENT_TAGS: EventTag[] = [
  EventTag.ACADEMIC,
  EventTag.SOCIAL,
  EventTag.SPORTS,
  EventTag.CAREER,
  EventTag.CULTURAL,
  EventTag.WELLNESS,
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
    badgeTheme: "bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300 shadow-[0_0_15px_rgba(59,130,246,0.15)] dark:shadow-[0_0_15px_rgba(59,130,246,0.2)]",
  },
  [EventTag.SOCIAL]: {
    label: "Social",
    color: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300",
    borderColor: "border-pink-400 dark:border-pink-500",
    selectedBg: "bg-pink-50 dark:bg-pink-950/40",
    checkColor: "bg-pink-600 text-white",
    icon: "Users",
    baseColor: "#ec4899", // tailwind pink-500
    badgeTheme: "bg-gradient-to-r from-pink-500/10 to-rose-500/10 border-pink-500/20 text-pink-700 dark:text-pink-300 shadow-[0_0_15px_rgba(236,72,153,0.15)] dark:shadow-[0_0_15px_rgba(236,72,153,0.2)]",
  },
  [EventTag.SPORTS]: {
    label: "Sports",
    color: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
    borderColor: "border-green-400 dark:border-green-500",
    selectedBg: "bg-green-50 dark:bg-green-950/40",
    checkColor: "bg-green-600 text-white",
    icon: "Trophy",
    baseColor: "#22c55e", // tailwind green-500
    badgeTheme: "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-green-500/20 text-green-700 dark:text-green-300 shadow-[0_0_15px_rgba(34,197,94,0.15)] dark:shadow-[0_0_15px_rgba(34,197,94,0.2)]",
  },
  [EventTag.CAREER]: {
    label: "Career",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
    borderColor: "border-purple-400 dark:border-purple-500",
    selectedBg: "bg-purple-50 dark:bg-purple-950/40",
    checkColor: "bg-purple-600 text-white",
    icon: "Briefcase",
    baseColor: "#a855f7", // tailwind purple-500
    badgeTheme: "bg-gradient-to-r from-purple-500/10 to-fuchsia-500/10 border-purple-500/20 text-purple-700 dark:text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.15)] dark:shadow-[0_0_15px_rgba(168,85,247,0.2)]",
  },
  [EventTag.CULTURAL]: {
    label: "Cultural",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
    borderColor: "border-orange-400 dark:border-orange-500",
    selectedBg: "bg-orange-50 dark:bg-orange-950/40",
    checkColor: "bg-orange-600 text-white",
    icon: "Palette",
    baseColor: "#f97316", // tailwind orange-500
    badgeTheme: "bg-gradient-to-r from-orange-500/10 to-amber-500/10 border-orange-500/20 text-orange-700 dark:text-orange-300 shadow-[0_0_15px_rgba(249,115,22,0.15)] dark:shadow-[0_0_15px_rgba(249,115,22,0.2)]",
  },
  [EventTag.WELLNESS]: {
    label: "Wellness",
    color: "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300",
    borderColor: "border-teal-400 dark:border-teal-500",
    selectedBg: "bg-teal-50 dark:bg-teal-950/40",
    checkColor: "bg-teal-600 text-white",
    icon: "Heart",
    baseColor: "#14b8a6", // tailwind teal-500
    badgeTheme: "bg-gradient-to-r from-teal-500/10 to-cyan-500/10 border-teal-500/20 text-teal-700 dark:text-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.15)] dark:shadow-[0_0_15px_rgba(20,184,166,0.2)]",
  },
} as const;

/**
 * Minimum number of saved events required before showing personalized recommendations.
 * Below this threshold, users see the popularity-ranked fallback feed.
 */
export const RECOMMENDATION_THRESHOLD = 3;

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

