/**
 * Utility functions for Uni-Verse
 */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, parseISO } from "date-fns";

/**
 * Merge Tailwind CSS classes with clsx and tailwind-merge
 * Used for conditional class names
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an ISO date string to a readable format
 * @param dateString - ISO date string (e.g., "2024-01-15")
 * @returns Formatted date string (e.g., "January 15, 2024")
 */
export function formatDate(dateString: string): string {
  try {
    const date = parseISO(dateString);
    return format(date, "MMMM d, yyyy");
  } catch (error) {
    return dateString;
  }
}

/**
 * Format a time string to 12-hour format
 * @param timeString - Time string in HH:mm format (e.g., "14:30")
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatTime(timeString: string): string {
  try {
    const [hours, minutes] = timeString.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  } catch (error) {
    return timeString;
  }
}

/**
 * Format a full datetime for display
 * @param dateString - ISO date string
 * @param timeString - Time string in HH:mm format
 * @returns Combined formatted string (e.g., "January 15, 2024 at 2:30 PM")
 */
export function formatDateTime(dateString: string, timeString: string): string {
  return `${formatDate(dateString)} at ${formatTime(timeString)}`;
}

/**
 * Check if an email is a McGill email
 * @param email - Email address to check
 * @returns True if the email is a McGill email
 */
export function isMcGillEmail(email: string): boolean {
  return email.endsWith("@mail.mcgill.ca") || email.endsWith("@mcgill.ca");
}

