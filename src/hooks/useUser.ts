"use client";

/**
 * Custom hook for managing user session and authentication
 * TODO: Implement user session management with Supabase auth
 */

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@/types";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // TODO: Implement user session fetching
    // 1. Get current session from Supabase
    // 2. Fetch user profile from database
    // 3. Handle loading and error states
    // 4. Update user state

    // TODO: Set up auth state change listener
    // supabase.auth.onAuthStateChange((event, session) => {
    //   // Handle auth state changes
    // });

    setLoading(false);
  }, []);

  const signOut = async () => {
    // TODO: Implement sign out logic
    const supabase = createClient();
    // await supabase.auth.signOut();
  };

  return {
    user,
    loading,
    error,
    signOut,
  };
}
