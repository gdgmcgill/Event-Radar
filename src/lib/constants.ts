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
  },
  [EventTag.SOCIAL]: {
    label: "Social",
    color: "bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-300",
    borderColor: "border-pink-400 dark:border-pink-500",
    selectedBg: "bg-pink-50 dark:bg-pink-950/40",
    checkColor: "bg-pink-600 text-white",
    icon: "Users",
  },
  [EventTag.SPORTS]: {
    label: "Sports",
    color: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
    borderColor: "border-green-400 dark:border-green-500",
    selectedBg: "bg-green-50 dark:bg-green-950/40",
    checkColor: "bg-green-600 text-white",
    icon: "Trophy",
  },
  [EventTag.CAREER]: {
    label: "Career",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300",
    borderColor: "border-purple-400 dark:border-purple-500",
    selectedBg: "bg-purple-50 dark:bg-purple-950/40",
    checkColor: "bg-purple-600 text-white",
    icon: "Briefcase",
  },
  [EventTag.CULTURAL]: {
    label: "Cultural",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300",
    borderColor: "border-orange-400 dark:border-orange-500",
    selectedBg: "bg-orange-50 dark:bg-orange-950/40",
    checkColor: "bg-orange-600 text-white",
    icon: "Palette",
  },
  [EventTag.WELLNESS]: {
    label: "Wellness",
    color: "bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300",
    borderColor: "border-teal-400 dark:border-teal-500",
    selectedBg: "bg-teal-50 dark:bg-teal-950/40",
    checkColor: "bg-teal-600 text-white",
    icon: "Heart",
  },
} as const;

export const API_ENDPOINTS = {
  EVENTS: "/api/events",
  EVENT_DETAIL: (id: string) => `/api/events/${id}`,
  SAVE_EVENT: (id: string) => `/api/events/${id}/save`,
  RECOMMENDATIONS: "/api/recommendations",
  ADMIN_EVENTS: "/api/admin/events",
  // Tracking & Popularity endpoints
  INTERACTIONS: "/api/interactions",
  POPULAR_EVENTS: "/api/events/popular",
  USER_ENGAGEMENT: "/api/user/engagement",
  ADMIN_CALCULATE_POPULARITY: "/api/admin/calculate-popularity",
} as const;

/**
 * McGill brand colors
 * Used for theming and semantic color definitions
 */
export const MCGILL_COLORS = {
  RED: "#ED1B2F",      // Primary McGill Red
  GREY: "#7f7f7f",     // McGill Grey (used in dark theme)
  DARK_BG: "#1f1f1f",  // Dark theme background
  DARK_CARD: "#2d2d2d", // Dark theme card background
} as const;


