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
    if (get().initialized) {
      console.log("[Auth] Already initialized, skipping");
      return;
    }

    set({ initialized: true });
    console.log("[Auth] Initializing...");

    const supabase = createClient();

    const fetchAndSetUser = async (authUser: {
      id: string;
      email?: string;
      user_metadata?: Record<string, unknown>;
      created_at: string;
      updated_at?: string;
    }) => {
      console.log("[Auth] Building user from auth data");

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
        is_admin: false,
        created_at: authUser.created_at,
        updated_at: authUser.updated_at ?? authUser.created_at,
      };

      set({ user: basicUser, loading: false });
      console.log("[Auth] User set immediately:", basicUser.email);

      // Fetch is_admin and interest_tags from public.users in the background
      try {
        const { data: profile } = await supabase
          .from("users")
          .select("is_admin, interest_tags")
          .eq("id", authUser.id)
          .single();

        if (profile) {
          set((state) => ({
            user: state.user
              ? {
                  ...state.user,
                  is_admin: profile.is_admin ?? false,
                  interest_tags: (profile.interest_tags as string[]) ?? [],
                }
              : state.user,
          }));
          console.log("[Auth] Updated profile: is_admin=%s, interest_tags=%d",
            profile.is_admin, (profile.interest_tags as string[] | null)?.length ?? 0);
        }
      } catch (err) {
        console.error("[Auth] Failed to fetch profile:", err);
      }
    };

    // Initial fetch
    const initialFetch = async () => {
      console.log("[Auth] Running initial fetch...");

      try {
        const {
          data: { user: authUser },
          error,
        } = await supabase.auth.getUser();

        console.log("[Auth] Initial getUser:", {
          email: authUser?.email,
          error: error?.message,
        });

        if (error || !authUser) {
          console.log("[Auth] No user found, setting loading: false");
          set({ user: null, loading: false });
          return;
        }

        await fetchAndSetUser(authUser);
      } catch (err) {
        console.error("[Auth] Initial fetch error:", err);
        set({ user: null, loading: false });
      }
    };

    // Use onAuthStateChange as the single source of truth.
    // INITIAL_SESSION fires immediately if a session exists, replacing initialFetch.
    let initialSessionHandled = false;

    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Auth] onAuthStateChange:", event, session?.user?.email);

      if (event === "INITIAL_SESSION" || (event === "SIGNED_IN" && !initialSessionHandled)) {
        initialSessionHandled = true;
        if (!session?.user) {
          console.log("[Auth] No initial session, setting loading: false");
          set({ user: null, loading: false });
          return;
        }
        await fetchAndSetUser(session.user);
        return;
      }

      if (event === "SIGNED_OUT" || !session?.user) {
        console.log("[Auth] Signed out, clearing user");
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
        console.log("[Auth] Auth event timeout, running fallback fetch");
        initialSessionHandled = true;
        initialFetch();
      }
    }, 3000);
  },

  signOut: async () => {
    console.log("[Auth] Signing out...");
    // Clear store state immediately so UI updates without waiting for network
    set({ user: null, loading: false });

    const supabase = createClient();
    // Use 'local' scope to clear cookies without a network request that can
    // hang indefinitely.  The server-side session expires via token expiry.
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      console.error("[Auth] Sign out error:", error.message);
    }
  },
}));

export default useAuthStore;