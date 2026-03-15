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
    }) => {
      // Set user immediately so the UI renders without waiting for DB
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

      set({ user: basicUser, loading: false });

      // Fetch roles, interest_tags, and club membership
      try {
        const profileResult = await supabase
          .from("users")
          .select("roles, interest_tags, inferred_tags, faculty, year, avatar_url")
          .eq("id", authUser.id)
          .single();

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

        set((state) => ({
          hasClubs,
          user: state.user && profile
            ? {
                ...state.user,
                roles,
                interest_tags: (profile.interest_tags as string[]) ?? [],
                inferred_tags: (profile.inferred_tags as string[]) ?? [],
                faculty: (profile.faculty as string) ?? null,
                year: (profile.year as string) ?? null,
                avatar_url: (profile.avatar_url as string) ?? state.user.avatar_url,
              }
            : state.user,
        }));
      } catch (err) {
        console.error("[AuthStore] Profile/club fetch failed:", err);
      }
    };

    // Initial fetch
    const initialFetch = async () => {
      try {
        const {
          data: { user: authUser },
          error,
        } = await supabase.auth.getUser();

        if (error || !authUser) {
          set({ user: null, loading: false });
          return;
        }

        await fetchAndSetUser(authUser);
      } catch {
        set({ user: null, loading: false });
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
        void fetchAndSetUser(authUser);
      }, 0);
    };

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || (event === "SIGNED_IN" && !initialSessionHandled)) {
        initialSessionHandled = true;
        if (!session?.user) {
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