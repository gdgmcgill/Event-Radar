import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * GET /api/users/me/suggestions — Suggest people based on shared clubs,
 * overlapping interest tags, same faculty/year, or shared event RSVPs.
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current user's profile
    const { data: profile } = await (supabase as any)
      .from("users")
      .select("interest_tags, faculty, year")
      .eq("id", user.id)
      .single();

    // Get who the user already follows
    const { data: following } = await (supabase as any)
      .from("user_follows")
      .select("following_id")
      .eq("follower_id", user.id);

    const followingIds = new Set(
      (following ?? []).map((f: any) => f.following_id)
    );
    followingIds.add(user.id); // exclude self

    // Get current user's clubs
    const { data: myClubMembers } = await (supabase as any)
      .from("club_members")
      .select("club_id")
      .eq("user_id", user.id);

    const myClubIds = (myClubMembers ?? []).map((m: any) => m.club_id);

    // Get current user's club follows
    const { data: myClubFollows } = await (supabase as any)
      .from("club_followers")
      .select("club_id")
      .eq("user_id", user.id);

    const allClubIds = [
      ...new Set([
        ...myClubIds,
        ...(myClubFollows ?? []).map((f: any) => f.club_id),
      ]),
    ];

    // Get current user's RSVPs
    const { data: myRsvps } = await (supabase as any)
      .from("event_rsvps")
      .select("event_id")
      .eq("user_id", user.id)
      .in("status", ["going", "interested"]);

    const myEventIds = (myRsvps ?? []).map((r: any) => r.event_id);

    type Suggestion = {
      id: string;
      name: string;
      avatar_url: string | null;
      faculty: string | null;
      year: string | null;
      reason: string;
      reason_type: "club" | "event" | "tags" | "faculty";
      score: number;
    };

    const suggestionsMap = new Map<string, Suggestion>();

    // 1. People in the same clubs
    if (allClubIds.length > 0) {
      const { data: clubMates } = await (supabase as any)
        .from("club_members")
        .select("user_id, club_id, clubs(name)")
        .in("club_id", allClubIds)
        .limit(100);

      for (const cm of clubMates ?? []) {
        if (followingIds.has(cm.user_id)) continue;
        const existing = suggestionsMap.get(cm.user_id);
        if (!existing || existing.score < 4) {
          suggestionsMap.set(cm.user_id, {
            id: cm.user_id,
            name: "",
            avatar_url: null,
            faculty: null,
            year: null,
            reason: `Both in ${cm.clubs?.name ?? "a club"}`,
            reason_type: "club",
            score: 4,
          });
        }
      }

      // Also check club followers
      const { data: clubFollowerMates } = await (supabase as any)
        .from("club_followers")
        .select("user_id, club_id, clubs(name)")
        .in("club_id", allClubIds)
        .limit(100);

      for (const cf of clubFollowerMates ?? []) {
        if (followingIds.has(cf.user_id)) continue;
        if (suggestionsMap.has(cf.user_id)) continue;
        suggestionsMap.set(cf.user_id, {
          id: cf.user_id,
          name: "",
          avatar_url: null,
          faculty: null,
          year: null,
          reason: `Both follow ${cf.clubs?.name ?? "a club"}`,
          reason_type: "club",
          score: 3,
        });
      }
    }

    // 2. People attending the same events
    if (myEventIds.length > 0) {
      const { data: eventMates } = await (supabase as any)
        .from("event_rsvps")
        .select("user_id, event_id, events(title)")
        .in("event_id", myEventIds)
        .in("status", ["going", "interested"])
        .limit(100);

      for (const em of eventMates ?? []) {
        if (followingIds.has(em.user_id)) continue;
        if (suggestionsMap.has(em.user_id)) continue;
        suggestionsMap.set(em.user_id, {
          id: em.user_id,
          name: "",
          avatar_url: null,
          faculty: null,
          year: null,
          reason: `Both attending ${em.events?.title ?? "an event"}`,
          reason_type: "event",
          score: 3,
        });
      }
    }

    // 3. People with overlapping interest tags
    const myTags: string[] = profile?.interest_tags ?? [];
    if (myTags.length > 0) {
      const { data: tagMatches } = await (supabase as any)
        .from("users")
        .select("id, interest_tags")
        .overlaps("interest_tags", myTags)
        .neq("id", user.id)
        .limit(50);

      for (const tm of tagMatches ?? []) {
        if (followingIds.has(tm.id)) continue;
        if (suggestionsMap.has(tm.id)) continue;
        const overlap = (tm.interest_tags ?? []).filter((t: string) =>
          myTags.includes(t)
        );
        suggestionsMap.set(tm.id, {
          id: tm.id,
          name: "",
          avatar_url: null,
          faculty: null,
          year: null,
          reason: `${overlap.length} shared interest${overlap.length > 1 ? "s" : ""}`,
          reason_type: "tags",
          score: 2,
        });
      }
    }

    // 4. Same faculty/year fallback
    if (profile?.faculty) {
      const { data: facultyMates } = await (supabase as any)
        .from("users")
        .select("id")
        .eq("faculty", profile.faculty)
        .neq("id", user.id)
        .limit(30);

      for (const fm of facultyMates ?? []) {
        if (followingIds.has(fm.id)) continue;
        if (suggestionsMap.has(fm.id)) continue;
        suggestionsMap.set(fm.id, {
          id: fm.id,
          name: "",
          avatar_url: null,
          faculty: null,
          year: null,
          reason: `${profile.faculty}`,
          reason_type: "faculty",
          score: 1,
        });
      }
    }

    // Fetch profile data for all suggestion user IDs
    const suggestionIds = [...suggestionsMap.keys()].slice(0, 30);

    if (suggestionIds.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    const { data: profiles } = await (supabase as any)
      .from("users")
      .select("id, name, avatar_url, faculty, year")
      .in("id", suggestionIds);

    // Enrich suggestions with profile data
    const suggestions: Suggestion[] = [];
    for (const p of profiles ?? []) {
      const s = suggestionsMap.get(p.id);
      if (!s) continue;
      suggestions.push({
        ...s,
        name: p.name,
        avatar_url: p.avatar_url,
        faculty: p.faculty,
        year: p.year,
      });
    }

    // Sort by score descending
    suggestions.sort((a, b) => b.score - a.score);

    return NextResponse.json({ suggestions: suggestions.slice(0, 20) });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500 }
    );
  }
}
