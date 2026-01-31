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
      console.log("[Auth] Building user from auth data (skipping DB fetch for now)");

      // Skip the database query for now - just use auth user data
      const finalUser: AppUser = {
        id: authUser.id,
        email: authUser.email ?? "",
        name:
          (authUser.user_metadata?.name as string) ??
          (authUser.user_metadata?.full_name as string) ??
          null,
        avatar_url: (authUser.user_metadata?.avatar_url as string) ?? null,
        interest_tags: [],
        created_at: authUser.created_at,
        updated_at: authUser.updated_at ?? authUser.created_at,
      };

      console.log("[Auth] Setting user:", finalUser.email);
      set({ user: finalUser, loading: false });
      console.log("[Auth] State updated, loading should be false now");
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

    // Run initial fetch
    initialFetch();

    // Listen for auth changes
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[Auth] onAuthStateChange:", event, session?.user?.email);

      if (event === "SIGNED_OUT" || !session?.user) {
        console.log("[Auth] Signed out, clearing user");
        set({ user: null, loading: false });
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        await fetchAndSetUser(session.user);
      }
    });
  },

  signOut: async () => {
    console.log("[Auth] Signing out...");
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null, loading: false });
  },
}));

export default useAuthStore;