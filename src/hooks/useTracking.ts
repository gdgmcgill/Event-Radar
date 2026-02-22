"use client";

/**
 * Custom hook for tracking user interactions with events
 * Provides debounced tracking helpers to avoid spamming the API
 */

import { useCallback, useRef, useEffect } from "react";
import { API_ENDPOINTS } from "@/lib/constants";
import type { InteractionType, InteractionSource, TrackInteractionPayload } from "@/types";

interface UseTrackingOptions {
  /** Default source for all interactions */
  source?: InteractionSource;
  /** Session ID for grouping interactions */
  sessionId?: string;
  /** Debounce time in ms for view events (default: 1000) */
  viewDebounceMs?: number;
  /** Enable/disable tracking (default: true) */
  enabled?: boolean;
}

interface TrackOptions {
  source?: InteractionSource;
  metadata?: Record<string, unknown>;
}

interface UseTrackingResult {
  /** Track a view interaction (debounced) */
  trackView: (eventId: string, options?: TrackOptions) => void;
  /** Track a click interaction */
  trackClick: (eventId: string, options?: TrackOptions) => void;
  /** Track a save interaction */
  trackSave: (eventId: string, options?: TrackOptions) => void;
  /** Track an unsave interaction */
  trackUnsave: (eventId: string, options?: TrackOptions) => void;
  /** Track a share interaction */
  trackShare: (eventId: string, options?: TrackOptions) => void;
  /** Track a calendar add interaction */
  trackCalendarAdd: (eventId: string, options?: TrackOptions) => void;
  /** Generic track function */
  track: (eventId: string, type: InteractionType, options?: TrackOptions) => void;
}

// Generate a unique session ID
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// Get or create session ID from sessionStorage
function getSessionId(): string {
  if (typeof window === "undefined") {
    return generateSessionId();
  }

  const storageKey = "tracking_session_id";
  let sessionId = sessionStorage.getItem(storageKey);

  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(storageKey, sessionId);
  }

  return sessionId;
}

export function useTracking(options: UseTrackingOptions = {}): UseTrackingResult {
  const {
    source: defaultSource,
    sessionId: customSessionId,
    viewDebounceMs = 1000,
    enabled = true,
  } = options;

  // Session ID (stable across hook re-renders)
  const sessionIdRef = useRef<string>(customSessionId || "");

  // Track which events have already been viewed to avoid duplicate view tracking
  const viewedEventsRef = useRef<Set<string>>(new Set());

  // Debounce timers for view events
  const viewTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Initialize session ID on mount
  useEffect(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = getSessionId();
    }
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    const timers = viewTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  /**
   * Send tracking request to the API
   */
  const sendTrackingRequest = useCallback(
    async (payload: TrackInteractionPayload) => {
      if (!enabled) return;

      try {
        const response = await fetch(API_ENDPOINTS.INTERACTIONS, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          console.warn("Failed to track interaction:", await response.text());
        }
      } catch (error) {
        // Silently fail - tracking should not break the app
        console.warn("Error tracking interaction:", error);
      }
    },
    [enabled]
  );

  /**
   * Generic track function
   */
  const track = useCallback(
    (eventId: string, type: InteractionType, trackOptions?: TrackOptions) => {
      if (!enabled) return;

      const payload: TrackInteractionPayload = {
        event_id: eventId,
        interaction_type: type,
        source: trackOptions?.source || defaultSource,
        session_id: sessionIdRef.current,
        metadata: trackOptions?.metadata,
      };

      sendTrackingRequest(payload);
    },
    [enabled, defaultSource, sendTrackingRequest]
  );

  /**
   * Track view with debouncing
   * Only tracks after user has been viewing for viewDebounceMs
   * Also deduplicates views within the same session
   */
  const trackView = useCallback(
    (eventId: string, trackOptions?: TrackOptions) => {
      if (!enabled) return;

      // Skip if already viewed in this session
      if (viewedEventsRef.current.has(eventId)) {
        return;
      }

      // Clear existing timer for this event
      const existingTimer = viewTimersRef.current.get(eventId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Set new debounced timer
      const timer = setTimeout(() => {
        viewedEventsRef.current.add(eventId);
        viewTimersRef.current.delete(eventId);
        track(eventId, "view", trackOptions);
      }, viewDebounceMs);

      viewTimersRef.current.set(eventId, timer);
    },
    [enabled, viewDebounceMs, track]
  );

  /**
   * Track click interaction
   */
  const trackClick = useCallback(
    (eventId: string, trackOptions?: TrackOptions) => {
      track(eventId, "click", trackOptions);
    },
    [track]
  );

  /**
   * Track save interaction
   */
  const trackSave = useCallback(
    (eventId: string, trackOptions?: TrackOptions) => {
      track(eventId, "save", trackOptions);
    },
    [track]
  );

  /**
   * Track unsave interaction
   */
  const trackUnsave = useCallback(
    (eventId: string, trackOptions?: TrackOptions) => {
      track(eventId, "unsave", trackOptions);
    },
    [track]
  );

  /**
   * Track share interaction
   */
  const trackShare = useCallback(
    (eventId: string, trackOptions?: TrackOptions) => {
      track(eventId, "share", trackOptions);
    },
    [track]
  );

  /**
   * Track calendar add interaction
   */
  const trackCalendarAdd = useCallback(
    (eventId: string, trackOptions?: TrackOptions) => {
      track(eventId, "calendar_add", trackOptions);
    },
    [track]
  );

  return {
    trackView,
    trackClick,
    trackSave,
    trackUnsave,
    trackShare,
    trackCalendarAdd,
    track,
  };
}

/**
 * Hook for tracking a specific event's modal view
 * Automatically tracks view when the modal is opened
 */
export function useTrackEventModal(
  eventId: string | null,
  isOpen: boolean,
  source?: InteractionSource
) {
  const { trackView } = useTracking({ source });
  const hasTrackedRef = useRef(false);

  useEffect(() => {
    if (isOpen && eventId && !hasTrackedRef.current) {
      trackView(eventId, { source: "modal" });
      hasTrackedRef.current = true;
    }

    // Reset when modal closes
    if (!isOpen) {
      hasTrackedRef.current = false;
    }
  }, [isOpen, eventId, trackView]);
}
