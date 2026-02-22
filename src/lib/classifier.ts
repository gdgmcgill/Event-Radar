/**
 * Event Classifier for Instagram Post Data
 *
 * Classifies raw Instagram posts from McGill club accounts as EVENT vs NON-EVENT
 * using a hybrid heuristic + regex approach with confidence scoring.
 *
 * Pipeline position: Apify output -> classifier -> webhook (pending_events)
 */

// =============================================
// Types
// =============================================

/** Raw Instagram post as returned by the Apify Instagram Post Scraper */
export interface InstagramPost {
  id: string;
  caption: string;
  timestamp: string; // ISO date of the post
  image_url: string;
  account: string; // Instagram handle of the club
  likes?: number;
  comments?: number;
  post_url?: string;
}

/** Structured event fields compatible with the events-webhook WebhookEvent */
export interface ExtractedEvent {
  title: string;
  description: string;
  category?: string;
  date: string; // ISO date string
  time?: string; // HH:mm format
  duration?: number;
  location: string;
  organizer: string;
  image_url?: string;
  tags?: string[];
}

/** Result of classifying a single Instagram post */
export interface ClassificationResult {
  post_id: string;
  is_event: boolean;
  confidence: number; // 0.0 to 1.0
  extracted_fields: ExtractedEvent | null;
  signals: ClassificationSignal[];
  raw_post: InstagramPost;
}

/** Individual signal that contributed to the classification decision */
export interface ClassificationSignal {
  name: string;
  matched: boolean;
  weight: number;
  detail?: string;
}

// =============================================
// Constants
// =============================================

/** Confidence thresholds for pipeline decisions */
export const CONFIDENCE_THRESHOLDS = {
  /** Auto-send to pending_events queue (high confidence event) */
  AUTO_PENDING: 0.7,
  /** Flag for manual review (ambiguous) */
  MANUAL_REVIEW: 0.4,
  /** Auto-discard (very unlikely to be an event) */
  AUTO_DISCARD: 0.4,
} as const;

// =============================================
// Regex patterns for field extraction
// =============================================

/** Date patterns covering common Instagram caption formats */
const DATE_PATTERNS = [
  // "Monday, January 15" or "Monday January 15th"
  /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?/i,
  // "January 15" or "Jan 15th"
  /(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+\d{4})?/i,
  // "15 January" or "15th of January"
  /(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)/i,
  // MM/DD/YYYY or MM/DD/YY or MM-DD-YYYY
  /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/,
  // YYYY-MM-DD (ISO-ish)
  /(\d{4})-(\d{2})-(\d{2})/,
  // French: "le 15 janvier" or "15 janvier"
  /(?:le\s+)?(\d{1,2})\s+(?:janvier|f[eé]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[eé]cembre)/i,
  // Relative: "this Thursday", "next Friday", "this Tuesday"
  /(?:this|next)\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
];

/** Time patterns for event start times. Each returns named groups: hours, minutes?, meridiem? */
const TIME_PATTERNS = [
  // "5:30 PM" or "5:30PM" or "5:30 pm"
  /(?<hours>\d{1,2}):(?<minutes>\d{2})\s*(?<meridiem>am|pm)/i,
  // "5 PM" or "5PM" (no minutes)
  /(?<hours>\d{1,2})\s*(?<meridiem>am|pm)/i,
  // "17:30" or "17h30" or "16 h 00" (24-hour / French with optional spaces)
  /(?<hours>\d{1,2})\s*[h:]\s*(?<minutes>\d{2})/,
  // Time ranges: "5-7 PM" or "5:30-7:00 PM" (extract start time)
  /(?<hours>\d{1,2})(?::(?<minutes>\d{2}))?\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?<meridiem>am|pm)/i,
];

/** Location patterns for McGill campus */
const LOCATION_PATTERNS = [
  // "Location: ..." or "Lieu: ..." or "Where: ..." (highest priority — explicit labels)
  /(?:location|lieu|where|o[uù])\s*[:：]\s*([^\n]{3,60})/i,
  // "📍 Shatner Building" (pin emoji only — not bare @, which matches Instagram handles)
  /📍\s*([^\n📍]{3,60})/,
  // Known McGill buildings/venues
  /\b((?:Leacock|Burnside|McConnell|Redpath|SSMU|Shatner|Thomson House|Trottier|Arts Building|Schulich|Bronfman|Macdonald Harrington|Macdonald Engineering|Stewart Bio|Wong|Brown|Rutherford|Strathcona|New Residence|Chancellor Day|Birks|Jeanne Sauvé|McTavish|Milton Gates|Roddick Gates|Lower Field|Molson Stadium|Memorial Pool|Tomlinson Fieldhouse|Tomlinson Hall|Players Theatre|Moyse Hall|EUS Common Room|Gert'?s Bar|ENGTR)\b[^,\n@]{0,40})/i,
];

/** Month name to 0-indexed month number */
const MONTH_MAP: Record<string, number> = {
  january: 0, jan: 0, février: 1, fevrier: 1, feb: 1, february: 1,
  march: 2, mar: 2, mars: 2, april: 3, apr: 3, avril: 3,
  may: 4, mai: 4, june: 5, jun: 5, juin: 5,
  july: 6, jul: 6, juillet: 6, august: 7, aug: 7, août: 7, aout: 7,
  september: 8, sep: 8, sept: 8, septembre: 8,
  october: 9, oct: 9, octobre: 9, november: 10, nov: 10, novembre: 10,
  december: 11, dec: 11, décembre: 11, decembre: 11, janvier: 0,
};

// =============================================
// Event indicator keywords
// =============================================

/** Strong event indicator keywords (English + French) */
const EVENT_KEYWORDS = [
  // English
  "join us", "come out", "rsvp", "register", "sign up", "signup",
  "tickets", "free entry", "free admission", "open to all",
  "don't miss", "save the date", "mark your calendar",
  "workshop", "seminar", "conference", "gala", "mixer",
  "info session", "panel", "hackathon", "tournament",
  "general assembly", "meeting", "pub crawl", "trivia night",
  "open mic", "showcase", "fundraiser", "bake sale",
  "movie night", "game night", "study session",
  // French
  "joignez-vous", "inscrivez-vous", "inscription",
  "billets", "gratuit", "ne manquez pas",
  "atelier", "séminaire", "conférence",
  "assemblée générale", "soirée", "spectacle",
];

/** Non-event indicator keywords */
const NON_EVENT_KEYWORDS = [
  "throwback", "recap", "highlights", "congrats", "congratulations",
  "thank you", "thanks to", "shoutout", "appreciation",
  "meet the team", "meet our", "introducing",
  "application", "applications open", "hiring", "we're looking for",
  "meme", "mood", "relatable", "follow us",
  "results", "winners", "announcement",
  "merci", "félicitations", "retour sur",
];

// =============================================
// Tag classification keywords
// =============================================

const TAG_KEYWORDS: Record<string, string[]> = {
  academic: [
    "lecture", "seminar", "workshop", "study", "tutorial", "academic",
    "research", "thesis", "course", "professor", "exam", "midterm",
    "hackathon", "coding", "programming", "tech talk",
  ],
  social: [
    "party", "mixer", "social", "hangout", "pub crawl", "trivia",
    "game night", "movie night", "karaoke", "potluck", "bbq",
    "networking", "meet and greet",
  ],
  sports: [
    "game", "match", "tournament", "intramural", "fitness", "yoga",
    "run", "marathon", "basketball", "soccer", "hockey", "volleyball",
    "swim", "gym", "workout", "training",
  ],
  career: [
    "career", "job", "internship", "resume", "interview", "recruiter",
    "professional", "consulting", "finance", "info session", "employer",
    "networking event", "career fair",
  ],
  cultural: [
    "art", "music", "dance", "theatre", "theater", "film", "concert",
    "exhibition", "gallery", "performance", "cultural", "show",
    "open mic", "showcase", "festival", "poetry",
  ],
  wellness: [
    "wellness", "mental health", "meditation", "mindfulness", "self-care",
    "health", "counseling", "support", "stress", "therapy", "breathing",
  ],
};

// =============================================
// Core Classification Logic
// =============================================

/**
 * Classify an Instagram post as EVENT or NON-EVENT.
 *
 * Uses a weighted signal approach:
 * - Date presence (high weight)
 * - Time presence (high weight)
 * - Location presence (medium weight)
 * - Event keywords (medium weight)
 * - Non-event keywords (negative weight)
 * - Caption structure heuristics (low weight)
 */
export function classifyPost(post: InstagramPost): ClassificationResult {
  const caption = post.caption || "";
  const captionLower = caption.toLowerCase();
  const signals: ClassificationSignal[] = [];

  // ---- Signal 1: Date detected ----
  const dateMatch = extractDate(caption, post.timestamp);
  signals.push({
    name: "date_detected",
    matched: dateMatch !== null,
    weight: 0.30,
    detail: dateMatch ? `Extracted date: ${dateMatch}` : undefined,
  });

  // ---- Signal 2: Time detected ----
  const timeMatch = extractTime(caption);
  signals.push({
    name: "time_detected",
    matched: timeMatch !== null,
    weight: 0.20,
    detail: timeMatch ? `Extracted time: ${timeMatch}` : undefined,
  });

  // ---- Signal 3: Location detected ----
  const locationMatch = extractLocation(caption);
  signals.push({
    name: "location_detected",
    matched: locationMatch !== null,
    weight: 0.20,
    detail: locationMatch ? `Extracted location: ${locationMatch}` : undefined,
  });

  // ---- Signal 4: Event keywords ----
  const eventKeywordMatches = EVENT_KEYWORDS.filter(kw =>
    captionLower.includes(kw.toLowerCase())
  );
  const hasEventKeywords = eventKeywordMatches.length > 0;
  signals.push({
    name: "event_keywords",
    matched: hasEventKeywords,
    weight: 0.15,
    detail: hasEventKeywords
      ? `Matched: ${eventKeywordMatches.slice(0, 3).join(", ")}`
      : undefined,
  });

  // ---- Signal 5: Non-event keywords (negative) ----
  const nonEventKeywordMatches = NON_EVENT_KEYWORDS.filter(kw =>
    captionLower.includes(kw.toLowerCase())
  );
  const hasNonEventKeywords = nonEventKeywordMatches.length > 0;
  signals.push({
    name: "non_event_keywords",
    matched: hasNonEventKeywords,
    weight: -0.20,
    detail: hasNonEventKeywords
      ? `Matched: ${nonEventKeywordMatches.slice(0, 3).join(", ")}`
      : undefined,
  });

  // ---- Signal 6: Caption length heuristic ----
  // Event posts tend to have longer captions with details
  const hasSubstantialCaption = caption.length > 80;
  signals.push({
    name: "substantial_caption",
    matched: hasSubstantialCaption,
    weight: 0.05,
    detail: `Caption length: ${caption.length} chars`,
  });

  // ---- Signal 7: Call-to-action patterns ----
  const ctaPattern = /\b(link in bio|swipe up|register|sign up|rsvp|dm us|click|tap)\b/i;
  const hasCTA = ctaPattern.test(caption);
  signals.push({
    name: "call_to_action",
    matched: hasCTA,
    weight: 0.10,
    detail: hasCTA ? "Contains call-to-action" : undefined,
  });

  // ---- Calculate confidence score ----
  let confidence = 0;
  for (const signal of signals) {
    if (signal.matched) {
      confidence += signal.weight;
    }
  }
  // Clamp to [0, 1]
  confidence = Math.max(0, Math.min(1, confidence));

  // ---- Determine is_event ----
  const is_event = confidence >= CONFIDENCE_THRESHOLDS.AUTO_DISCARD;

  // ---- Extract fields if classified as event ----
  let extracted_fields: ExtractedEvent | null = null;
  if (is_event && dateMatch) {
    const title = extractTitle(caption, post.account);
    const tags = classifyTags(caption);

    extracted_fields = {
      title,
      description: truncateDescription(caption),
      date: dateMatch,
      time: timeMatch || undefined,
      location: locationMatch || "TBD",
      organizer: cleanAccountName(post.account),
      image_url: post.image_url,
      tags,
    };
  }

  return {
    post_id: post.id,
    is_event,
    confidence,
    extracted_fields,
    signals,
    raw_post: post,
  };
}

/**
 * Classify a batch of Instagram posts.
 * Returns results sorted by confidence (highest first).
 */
export function classifyBatch(posts: InstagramPost[]): ClassificationResult[] {
  return posts
    .map(classifyPost)
    .sort((a, b) => b.confidence - a.confidence);
}

/**
 * Filter classified results by pipeline action:
 * - auto_pending: confidence >= AUTO_PENDING
 * - manual_review: MANUAL_REVIEW <= confidence < AUTO_PENDING
 * - auto_discard: confidence < AUTO_DISCARD
 */
export function partitionByAction(results: ClassificationResult[]) {
  return {
    auto_pending: results.filter(r => r.confidence >= CONFIDENCE_THRESHOLDS.AUTO_PENDING),
    manual_review: results.filter(
      r => r.confidence >= CONFIDENCE_THRESHOLDS.MANUAL_REVIEW &&
           r.confidence < CONFIDENCE_THRESHOLDS.AUTO_PENDING
    ),
    auto_discard: results.filter(r => r.confidence < CONFIDENCE_THRESHOLDS.AUTO_DISCARD),
  };
}

// =============================================
// Field Extraction Helpers
// =============================================

/**
 * Extract a date string from the caption, returning ISO date or null.
 * Uses the post timestamp as a reference year when the caption omits it.
 */
export function extractDate(caption: string, postTimestamp: string): string | null {
  const refDate = new Date(postTimestamp);
  const refYear = refDate.getFullYear();

  for (const pattern of DATE_PATTERNS) {
    const match = caption.match(pattern);
    if (!match) continue;

    // Handle relative day references ("this Thursday", "next Friday")
    const relativeDayMatch = match[0].match(/(?:this|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    if (relativeDayMatch) {
      const parsed = resolveRelativeDay(relativeDayMatch[1], refDate, /next/i.test(match[0]));
      if (parsed) return parsed;
      continue;
    }

    // Try to parse the matched date
    const parsed = parseDateMatch(match, refYear);
    if (parsed) return parsed;
  }

  return null;
}

const DAY_INDICES: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

/**
 * Resolve "this Thursday" or "next Friday" relative to a reference date.
 * Uses UTC to avoid timezone-dependent day shifts.
 */
function resolveRelativeDay(dayName: string, refDate: Date, isNext: boolean): string | null {
  const targetDay = DAY_INDICES[dayName.toLowerCase()];
  if (targetDay === undefined) return null;

  const currentDay = refDate.getUTCDay();
  let daysAhead = targetDay - currentDay;
  if (daysAhead <= 0) daysAhead += 7;
  if (isNext) daysAhead += 7;

  const result = new Date(refDate);
  result.setUTCDate(result.getUTCDate() + daysAhead);
  return result.toISOString().split("T")[0];
}

/**
 * Parse a regex match array into an ISO date string.
 */
function parseDateMatch(match: RegExpMatchArray, refYear: number): string | null {
  const fullMatch = match[0].toLowerCase();

  // Try named month patterns first
  for (const [monthName, monthIdx] of Object.entries(MONTH_MAP)) {
    if (fullMatch.includes(monthName)) {
      // Find the day number in the match
      const dayMatch = fullMatch.match(/(\d{1,2})/);
      if (dayMatch) {
        const day = parseInt(dayMatch[1], 10);
        if (day >= 1 && day <= 31) {
          // Check for explicit year
          const yearMatch = fullMatch.match(/(\d{4})/);
          const year = yearMatch ? parseInt(yearMatch[1], 10) : refYear;
          const date = new Date(year, monthIdx, day);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split("T")[0];
          }
        }
      }
      break;
    }
  }

  // Try numeric date formats: MM/DD/YYYY or YYYY-MM-DD
  const numericSlash = fullMatch.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (numericSlash) {
    const [, a, b, c] = numericSlash;
    let year = parseInt(c, 10);
    if (year < 100) year += 2000;
    const month = parseInt(a, 10) - 1;
    const day = parseInt(b, 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }

  const isoMatch = fullMatch.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  return null;
}

/**
 * Extract time from caption, returning HH:mm format or null.
 */
export function extractTime(caption: string): string | null {
  for (const pattern of TIME_PATTERNS) {
    const match = caption.match(pattern);
    if (!match?.groups) continue;

    let hours = parseInt(match.groups.hours, 10);
    const minutes = match.groups.minutes ? parseInt(match.groups.minutes, 10) : 0;
    const meridiem = match.groups.meridiem?.toLowerCase();

    // Convert 12-hour to 24-hour
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;

    // Validate
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * Extract location from caption.
 */
export function extractLocation(caption: string): string | null {
  for (const pattern of LOCATION_PATTERNS) {
    const match = caption.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Extract a title from the caption.
 * Strategy: use the first line or first sentence, falling back to the account name.
 */
function extractTitle(caption: string, account: string): string {
  // Use the first non-empty line as the title
  const lines = caption.split("\n").map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length > 0) {
    let title = lines[0];
    // Remove emojis and leading/trailing punctuation
    title = title.replace(/[\u{1F600}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu, "").trim();
    // Cap at 100 characters
    if (title.length > 100) {
      title = title.substring(0, 97) + "...";
    }
    if (title.length > 0) {
      return title;
    }
  }

  return `Event by ${cleanAccountName(account)}`;
}

/**
 * Truncate a caption to serve as an event description.
 */
function truncateDescription(caption: string): string {
  if (caption.length <= 1000) return caption;
  return caption.substring(0, 997) + "...";
}

/**
 * Clean an Instagram handle into a display name.
 * e.g., "mcgill_sus" -> "McGill SUS"
 */
function cleanAccountName(account: string): string {
  return account
    .replace(/^@/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Classify which tags apply to the event based on caption content.
 * Returns array of tag strings matching the 6 canonical EventTag values.
 */
function classifyTags(caption: string): string[] {
  const captionLower = caption.toLowerCase();
  const matchedTags: string[] = [];

  for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
    const hasMatch = keywords.some(kw => captionLower.includes(kw));
    if (hasMatch) {
      matchedTags.push(tag);
    }
  }

  // Default to "social" if no tags matched
  if (matchedTags.length === 0) {
    matchedTags.push("social");
  }

  return matchedTags;
}
