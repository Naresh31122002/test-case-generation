"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { getCurrentUser, logout as apiLogout, type AuthUser } from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  /** True until the initial /auth/me check resolves (avoids UI flash). */
  loading: boolean;
  /** Re-fetch the current user (e.g. after verifying email or switching). */
  refresh: () => Promise<AuthUser | null>;
  /** Replace the cached user without a round-trip (used right after login). */
  setUser: (u: AuthUser | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Session persistence. Reads the JWT-cookie session via /auth/me once on mount
 * and holds the user client-side so components can render auth state without
 * re-fetching. The httpOnly cookie is the source of truth; this is a cache.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const u = await getCurrentUser();
    setUser(u);
    return u;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await getCurrentUser();
      if (!cancelled) {
        setUser(u);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, setUser, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
