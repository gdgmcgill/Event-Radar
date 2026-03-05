# types/index.ts and lib/constants.ts

`src/types/index.ts` defines all TypeScript interfaces and types that map to Supabase tables: `Event`, `Club`, `User`, `ClubMember`, `OrganizerRequest`, `SavedEvent`, `Notification`, `EventFilter`, `EventPopularityScore`, `TrackInteractionPayload`, plus enums (`EventTag`) and union types (`UserRole`, `RsvpStatus`, `InteractionSource`, `RecommendationFeedbackAction`).

`src/lib/constants.ts` exports `EVENT_TAGS`, `EVENT_CATEGORIES` (per-tag styling metadata), and `RECOMMENDATION_THRESHOLD`.

**Changes:** Removed three dead types (`ClubFollower`, `RecommendationFeedbackPayload`, `RecommendationFeedback`) and two unused constants (`API_ENDPOINTS`, `MCGILL_COLORS`) — none were referenced outside their own files.
