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
  signOut: () => Promise<void>;
  updateAvatar: (avatarUrl: string) => void;
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
        saved_events_count: 0,
        roles: ["user"],
        created_at: authUser.created_at,
        updated_at: authUser.updated_at ?? authUser.created_at,
      };

      set({ user: basicUser, loading: false });

      // Fetch roles, interest_tags, and club membership in parallel
      try {
        const [{ data: profile }, { count: clubCount }] = await Promise.all([
          supabase
            .from("users")
            .select("roles, interest_tags")
            .eq("id", authUser.id)
            .single(),
          supabase
            .from("club_members")
            .select("*", { count: "exact", head: true })
            .eq("user_id", authUser.id),
        ]);

        set((state) => ({
          hasClubs: (clubCount ?? 0) > 0,
          user: state.user && profile
            ? {
                ...state.user,
                roles: (profile.roles as AppUser["roles"]) ?? ["user"],
                interest_tags: (profile.interest_tags as string[]) ?? [],
              }
            : state.user,
        }));
      } catch {
        // Profile fetch failure is non-fatal; user remains with defaults
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

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "INITIAL_SESSION" || (event === "SIGNED_IN" && !initialSessionHandled)) {
        initialSessionHandled = true;
        if (!session?.user) {
          set({ user: null, loading: false });
          return;
        }
        await fetchAndSetUser(session.user);
        return;
      }

      if (event === "SIGNED_OUT" || !session?.user) {
        set({ user: null, loading: false, hasClubs: false });
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        await fetchAndSetUser(session.user);
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

  updateAvatar: (avatarUrl: string) => {
    set((state) => ({
      user: state.user ? { ...state.user, avatar_url: avatarUrl } : null,
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