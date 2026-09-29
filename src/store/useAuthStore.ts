"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { User as AppUser } from "@/types";

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  initialized: boolean;
  hasClubs: boolean;
  initialize: () => void;
  updateUser: (fields: Partial<AppUser>) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  loading: true,
  initialized: false,
  hasClubs: false,

  initialize: () => {
    if (get().initialized) return;

    set({ initialized: true });

    const supabase = createClient();

    const fetchAndSetUser = async (authUser: {
      id: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
      created_at: string;
      updated_at?: string;
    }, requestId: number) => {
      // Admission is complete only after the server has synchronized a profile.
      // Publishing the OTP Auth user earlier renders authenticated Next Links;
      // their prefetch can hit the missing-profile ring and revoke the session.
      const basicUser: AppUser = {
        id: authUser.id,
        email: authUser.email ?? "",
        name:
          (authUser.user_metadata?.name as string) ??
          (authUser.user_metadata?.full_name as string) ??
          null,
        avatar_url: (authUser.user_metadata?.avatar_url as string) ?? null,
        interest_tags: [],
        inferred_tags: [],
        saved_events_count: 0,
        roles: ["user"],
        created_at: authUser.created_at,
        updated_at: authUser.updated_at ?? authUser.created_at,
      };

      set(state => ({ user: state.user?.id === authUser.id ? state.user : null, loading: true }));

      // Fetch roles, interest_tags, and club membership
      try {
        const profileResult = await supabase
          .from("users")
          .select("roles, name, onboarding_completed, university_id, other_university, program, affiliation_source, interest_tags, inferred_tags, faculty, year, avatar_url")
          .eq("id", authUser.id)
          .single();
        if (requestId !== authRequestId) return;
        if (profileResult.error || !profileResult.data) {
          // OTP completion owns profile creation. Leave the browser session
          // intact and the UI anonymous until its callback navigation finishes.
          set({ user: null, loading: false, hasClubs: false });
          return;
        }

        const clubResult = await supabase
          .from("club_members")
          .select("*", { count: "exact", head: true })
          .eq("user_id", authUser.id);

        const profile = profileResult.data as Record<string, unknown> | null;
        const roles = (profile?.roles as AppUser["roles"]) ?? ["user"];
        const isOrganizerFromProfile = Array.isArray(roles) && roles.includes("club_organizer");

        // Only trust club count when the query succeeded; otherwise fall back to club_organizer role
        // so organizers still see "My Clubs" when the count query fails (e.g. RLS/network).
        const clubCountOk = clubResult.error == null;
        const hasClubs = clubCountOk
          ? (clubResult.count ?? 0) > 0
          : isOrganizerFromProfile;

        if (requestId !== authRequestId) return;
        set(() => ({
          loading: false,
          hasClubs,
          user: profile
            ? {
                ...basicUser,
                roles,
                name: (profile.name as string) ?? basicUser.name,
                onboarding_completed: profile.onboarding_completed === true,
                university_id: (profile.university_id as string) ?? null,
                other_university: (profile.other_university as string) ?? null,
                program: (profile.program as string) ?? null,
                affiliation_source: (profile.affiliation_source as AppUser["affiliation_source"]) ?? null,
                interest_tags: (profile.interest_tags as string[]) ?? [],
                inferred_tags: (profile.inferred_tags as string[]) ?? [],
                faculty: (profile.faculty as string) ?? null,
                year: (profile.year as string) ?? null,
                avatar_url: (profile.avatar_url as string) ?? basicUser.avatar_url,
              }
            : null,
        }));
      } catch (err) {
        console.error("[AuthStore] Profile/club fetch failed:", err);
        if (requestId === authRequestId) set({ user: null, loading: false, hasClubs: false });
      }
    };

    // Initial fetch
    const initialFetch = async () => {
      const requestId = ++authRequestId;
      try {
        const {
          data: { user: authUser },
          error,
        } = await supabase.auth.getUser();

        if (requestId !== authRequestId) return;
        if (error || !authUser) {
          set({ user: null, loading: false });
          return;
        }

        await fetchAndSetUser(authUser, requestId);
      } catch {
        if (requestId === authRequestId) set({ user: null, loading: false });
      }
    };

    // Use onAuthStateChange as the single source of truth.
    // INITIAL_SESSION fires immediately if a session exists, replacing initialFetch.
    let initialSessionHandled = false;
    let authRequestId = 0;

    const scheduleUserFetch = (authUser: {
      id: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
      created_at: string;
      updated_at?: string;
    }) => {
      const requestId = ++authRequestId;
      // Avoid running PostgREST queries inside the auth callback call stack.
      // With @supabase/ssr this can hang indefinitely on some SIGNED_IN flows.
      setTimeout(() => {
        // Ignore stale jobs that were superseded by newer auth events.
        if (requestId !== authRequestId) return;
        void fetchAndSetUser(authUser, requestId);
      }, 0);
    };

    supabase.auth.onAuthStateChange((event, session) => {
      console.log("[AuthStore] onAuthStateChange:", event, "hasSession:", !!session, "hasUser:", !!session?.user);

      if (event === "INITIAL_SESSION" || (event === "SIGNED_IN" && !initialSessionHandled)) {
        initialSessionHandled = true;
        if (!session?.user) {
          console.log("[AuthStore] No user in session for event:", event);
          authRequestId++;
          set({ user: null, loading: false });
          return;
        }
        scheduleUserFetch(session.user);
        return;
      }

      if (event === "SIGNED_OUT" || !session?.user) {
        authRequestId++;
        set({ user: null, loading: false, hasClubs: false });
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        scheduleUserFetch(session.user);
      }
    });

    // Fallback: if no auth event has fired after 3s, run manual fetch
    setTimeout(async () => {
      if (!initialSessionHandled) {
        initialSessionHandled = true;
        initialFetch();
      }
    }, 3000);
  },

  updateUser: (fields) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...fields } : state.user,
    }));
  },

  signOut: async () => {
    // Sign out via server route so cookies are properly cleared.
    // The browser client's signOut() hangs with @supabase/ssr,
    // leaving auth cookies intact and the user still logged in on refresh.
    await fetch("/auth/signout", { method: "POST", redirect: "manual" });
  },
}));

export default useAuthStore;