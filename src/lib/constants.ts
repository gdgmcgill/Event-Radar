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
    color: "bg-blue-100 text-blue-800",
    icon: "GraduationCap",
  },
  [EventTag.SOCIAL]: {
    label: "Social",
    color: "bg-pink-100 text-pink-800",
    icon: "Users",
  },
  [EventTag.SPORTS]: {
    label: "Sports",
    color: "bg-green-100 text-green-800",
    icon: "Trophy",
  },
  [EventTag.CAREER]: {
    label: "Career",
    color: "bg-purple-100 text-purple-800",
    icon: "Briefcase",
  },
  [EventTag.CULTURAL]: {
    label: "Cultural",
    color: "bg-orange-100 text-orange-800",
    icon: "Palette",
  },
  [EventTag.WELLNESS]: {
    label: "Wellness",
    color: "bg-teal-100 text-teal-800",
    icon: "Heart",
  },
} as const;

export const API_ENDPOINTS = {
  EVENTS: "/api/events",
  EVENT_DETAIL: (id: string) => `/api/events/${id}`,
  SAVE_EVENT: (id: string) => `/api/events/${id}/save`,
  RECOMMENDATIONS: "/api/recommendations",
  ADMIN_EVENTS: "/api/admin/events",
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


