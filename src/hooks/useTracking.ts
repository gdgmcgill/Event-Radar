"use client";

import { useCallback } from "react";
import type { RecommendationFeedbackAction } from "@/types";

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
        user_id: "", // Server uses auth user
        session_id: payload.session_id ?? getSessionId(),
      }),
    });
  } catch (e) {
    console.warn("Recommendation feedback failed:", e);
  }
}

export function useTracking() {
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

  return {
    trackRecommendationImpression,
    trackRecommendationClick,
    trackRecommendationSave,
    trackRecommendationDismiss,
    submitThumbsFeedback,
  };
}
