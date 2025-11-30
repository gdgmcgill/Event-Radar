"use client";

/**
 * Custom hook for fetching and managing current user authentication state
 * Uses Supabase client to get the authenticated user
 */

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/types";

interface UseUserReturn {
  user: User | null;
  loading: boolean;
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    // Get initial user
    supabase.auth.getUser().then(({ data: { user: authUser }, error }) => {
      if (error || !authUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Fetch user profile from database
      supabase
        .from("users")
        .select("*")
        .eq("id", authUser.id)
        .single()
        .then(({ data, error: profileError }) => {
          if (profileError || !data) {
            // If profile doesn't exist, create a basic user object from auth
            setUser({
              id: authUser.id,
              email: authUser.email || "",
              full_name: authUser.user_metadata?.full_name || null,
              interest_tags: [],
              created_at: authUser.created_at,
              updated_at: authUser.updated_at || authUser.created_at,
            });
          } else {
            setUser(data as User);
          }
          setLoading(false);
        });
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        // Fetch user profile when auth state changes
        supabase
          .from("users")
          .select("*")
          .eq("id", session.user.id)
          .single()
          .then(({ data, error }) => {
            if (error || !data) {
              setUser({
                id: session.user.id,
                email: session.user.email || "",
                full_name: session.user.user_metadata?.full_name || null,
                interest_tags: [],
                created_at: session.user.created_at,
                updated_at: session.user.updated_at || session.user.created_at,
              });
            } else {
              setUser(data as User);
            }
            setLoading(false);
          });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}

