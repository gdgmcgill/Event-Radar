"use client";

import { useCallback, useEffect, useRef } from "react";
import type { RecommendationFeedbackAction, InteractionSource } from "@/types";
import type {
  AnalyticsFeedbackBodyInput,
  ThumbsFeedbackBodyInput,
  ThumbsFeedbackResponse,
} from "@/contracts/recommendations";
import type { InteractionBodyInput } from "@/contracts/interactions";
import { checkResponseInDev } from "@/lib/contractCheck";

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
    // The analytics arm of the route's contract. `user_id: ""` is sent as it
    // always was; the contract declares no user_id, so the handler drops it
    // and writes the caller's own id (DI-44).
    const body: AnalyticsFeedbackBodyInput & { user_id: string } = {
      ...payload,
      user_id: "",
      session_id: payload.session_id ?? getSessionId(),
    };
    await fetch("/api/recommendations/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.warn("Recommendation feedback failed:", e);
  }
}

async function sendInteraction(payload: {
  event_id: string;
  interaction_type: InteractionBodyInput["interaction_type"];
  source?: InteractionSource | null;
}) {
  try {
    const body: InteractionBodyInput = {
      ...payload,
      session_id: getSessionId(),
    };
    await fetch("/api/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.warn("Interaction tracking failed:", e);
  }
}

/**
 * Development only: check the response against its contract (plan 06-11,
 * REFAC-16). Module-level, outside the hook, so the hook body holds no
 * dynamic import; in a production build the branch, and the import with it,
 * is removed.
 */
function checkThumbsInDev(json: unknown) {
  if (process.env.NODE_ENV !== "production") {
    void checkResponseInDev(
      "POST /api/recommendations/feedback",
      (): Promise<typeof ThumbsFeedbackResponse> =>
        import("@/contracts/recommendations").then(
          (m) => m.ThumbsFeedbackResponse
        ),
      json
    );
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
      const body: ThumbsFeedbackBodyInput = { event_id: eventId, feedback };
      const res = await fetch("/api/recommendations/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to submit feedback");
      const json = await res.json();
      checkThumbsInDev(json);
      return json;
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
