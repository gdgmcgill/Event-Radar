"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RecommendationFeedbackAction, InteractionSource } from "@/types";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let s = sessionStorage.getItem("recommendation_session_id");
  if (!s) {
    s = crypto.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem("recommendation_session_id", s);
  }
  return s;
}

async function sendFeedback(payload: {
  event_id: string;
  recommendation_rank: number;
  action: RecommendationFeedbackAction;
  session_id?: string;
}) {
  try {
    await fetch("/api/recommendations/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        user_id: "",
        session_id: payload.session_id ?? getSessionId(),
      }),
    });
  } catch (e) {
    console.warn("Recommendation feedback failed:", e);
  }
}

async function sendInteraction(payload: {
  event_id: string;
  interaction_type: string;
  source?: InteractionSource | null;
}) {
  try {
    await fetch("/api/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        session_id: getSessionId(),
      }),
    });
  } catch (e) {
    console.warn("Interaction tracking failed:", e);
  }
}

interface UseTrackingOptions {
  source?: InteractionSource;
}

export function useTracking(options?: UseTrackingOptions) {
  const source = options?.source ?? null;

  const trackRecommendationImpression = useCallback(
    (eventId: string, rank: number) => {
      sendFeedback({
        event_id: eventId,
        recommendation_rank: rank,
        action: "impression",
      });
    },
    []
  );

  const trackRecommendationClick = useCallback(
    (eventId: string, rank: number) => {
      sendFeedback({
        event_id: eventId,
        recommendation_rank: rank,
        action: "click",
      });
    },
    []
  );

  const trackRecommendationSave = useCallback(
    (eventId: string, rank: number) => {
      sendFeedback({
        event_id: eventId,
        recommendation_rank: rank,
        action: "save",
      });
    },
    []
  );

  const trackRecommendationDismiss = useCallback(
    (eventId: string, rank: number) => {
      sendFeedback({
        event_id: eventId,
        recommendation_rank: rank,
        action: "dismiss",
      });
    },
    []
  );

  const submitThumbsFeedback = useCallback(
    async (eventId: string, feedback: "positive" | "negative") => {
      const res = await fetch("/api/recommendations/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event_id: eventId, feedback }),
      });
      if (!res.ok) throw new Error("Failed to submit feedback");
      return res.json();
    },
    []
  );

  const trackClick = useCallback(
    (eventId: string) => {
      sendInteraction({ event_id: eventId, interaction_type: "click", source });
    },
    [source]
  );

  const trackShare = useCallback(
    (eventId: string) => {
      sendInteraction({ event_id: eventId, interaction_type: "share", source });
    },
    [source]
  );

  const trackCalendarAdd = useCallback(
    (eventId: string) => {
      sendInteraction({ event_id: eventId, interaction_type: "calendar_add", source });
    },
    [source]
  );

  return {
    trackRecommendationImpression,
    trackRecommendationClick,
    trackRecommendationSave,
    trackRecommendationDismiss,
    submitThumbsFeedback,
    trackClick,
    trackShare,
    trackCalendarAdd,
  };
}

export function useTrackEventModal(
  eventId: string | null,
  isOpen: boolean,
  source?: InteractionSource
) {
  const tracked = useRef<string | null>(null);

  useEffect(() => {
    if (isOpen && eventId && tracked.current !== eventId) {
      tracked.current = eventId;
      sendInteraction({
        event_id: eventId,
        interaction_type: "view",
        source: source ?? "modal",
      });
    }
    if (!isOpen) {
      tracked.current = null;
    }
  }, [isOpen, eventId, source]);
}
