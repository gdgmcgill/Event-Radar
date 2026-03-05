"use client";

import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";
import type { User as AppUser } from "@/types";

interface AuthState {
  user: AppUser | null;
  loading: boolean;
  initialized: boolean;
  initialize: () => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  loading: true,
  initialized: false,

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
        roles: ["user"],
        created_at: authUser.created_at,
        updated_at: authUser.updated_at ?? authUser.created_at,
      };

      set({ user: basicUser, loading: false });

      // Fetch roles and interest_tags from public.users in the background
      try {
        const { data: profile } = await supabase
          .from("users")
          .select("roles, interest_tags")
          .eq("id", authUser.id)
          .single();

        if (profile) {
          set((state) => ({
            user: state.user
              ? {
                  ...state.user,
                  roles: (profile.roles as AppUser["roles"]) ?? ["user"],
                  interest_tags: (profile.interest_tags as string[]) ?? [],
                }
              : state.user,
          }));
        }
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
        set({ user: null, loading: false });
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

  signOut: async () => {
    // Sign out via server route so cookies are properly cleared.
    // The browser client's signOut() hangs with @supabase/ssr,
    // leaving auth cookies intact and the user still logged in on refresh.
    await fetch("/auth/signout", { method: "POST", redirect: "manual" });
  },
}));

export default useAuthStore;