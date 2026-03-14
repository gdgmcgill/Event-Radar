"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const initialize = useAuthStore((state) => state.initialize);
  const user = useAuthStore((state) => state.user);
  const loading = useAuthStore((state) => state.loading);
  const toastedRef = useRef(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (loading || toastedRef.current) return;

    const pending = sessionStorage.getItem("pendingSignIn");
    if (pending && user) {
      sessionStorage.removeItem("pendingSignIn");
      toastedRef.current = true;
      setShowSuccessToast(true);
    }
  }, [user, loading]);

  useEffect(() => {
    if (!showSuccessToast) return;

    const timeoutId = window.setTimeout(() => {
      setShowSuccessToast(false);
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [showSuccessToast]);

  return (
    <>
      {children}
      {showSuccessToast ? (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4">
          <div className="flex items-center justify-center gap-2 rounded-full border border-emerald-200 bg-white/95 px-5 py-3 text-center text-sm font-medium text-emerald-700 shadow-lg shadow-black/10 backdrop-blur dark:border-emerald-900/60 dark:bg-zinc-950/95 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>Successfully signed in</span>
          </div>
        </div>
      ) : null}
    </>
  );
}