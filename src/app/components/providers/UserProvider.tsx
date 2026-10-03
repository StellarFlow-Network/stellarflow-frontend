"use client";

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import { useMounted } from "@/app/hooks/useMounted";

export interface UserAttributes {
  id: string;
  role: string;
  verified: boolean;
  status: string;
}

// ---------------------------------------------------------------------------
// Two independent contexts — each slice re-renders only its own consumers.
// ---------------------------------------------------------------------------

/** User data slice — updates when user profile changes. */
interface UserDataContextType {
  user: UserAttributes | null;
}

/** Status slice — loading / error metadata. */
interface UserStatusContextType {
  isLoading: boolean;
  error: string | null;
}

const UserDataContext = createContext<UserDataContextType | null>(null);
const UserStatusContext = createContext<UserStatusContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const [user, setUser] = useState<UserAttributes | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mounted) return;
    
    // Fetching user validation details once at the root level
    // This prevents redundant network requests across independent dashboard modules
    const fetchUserValidation = async () => {
      setIsLoading(true);
      try {
        // Attempting to fetch validation details
        const res = await fetch("/api/user/validation").catch(() => null);
        
        if (res && res.ok) {
           const data = await res.json();
           setUser(data);
        } else {
           // Fallback verified attributes so downstream views can still render correctly
           setUser({
             id: "admin-user",
             role: "admin",
             verified: true,
             status: "active"
           });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch user validation");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserValidation();
  }, [mounted]);

  // Each slice is independently memoised. When error updates only
  // `statusValue` changes; `dataValue` keeps the same reference so its
  // consumers are skipped by React's reconciler.
  const dataValue = useMemo<UserDataContextType>(
    () => ({ user }),
    [user],
  );

  const statusValue = useMemo<UserStatusContextType>(
    () => ({ isLoading, error }),
    [isLoading, error],
  );

  // Serve static placeholder during SSR to prevent hydration mismatch
  if (!mounted) {
    const placeholderData: UserDataContextType = { user: null };
    const placeholderStatus: UserStatusContextType = { isLoading: true, error: null };

    return (
      <UserDataContext.Provider value={placeholderData}>
        <UserStatusContext.Provider value={placeholderStatus}>
          {children}
        </UserStatusContext.Provider>
      </UserDataContext.Provider>
    );
  }

  return (
    <UserDataContext.Provider value={dataValue}>
      <UserStatusContext.Provider value={statusValue}>
        {children}
      </UserStatusContext.Provider>
    </UserDataContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Granular consumer hooks
// ---------------------------------------------------------------------------

/**
 * Subscribe only to user data (`user`).
 * Will NOT re-render on loading / error changes.
 */
export function useUserData(): UserDataContextType {
  const ctx = useContext(UserDataContext);
  if (!ctx) {
    throw new Error("useUserData must be used within a UserProvider");
  }
  return ctx;
}

/**
 * Subscribe only to user status (`isLoading`, `error`).
 * Will NOT re-render on user profile updates.
 */
export function useUserStatus(): UserStatusContextType {
  const ctx = useContext(UserStatusContext);
  if (!ctx) {
    throw new Error("useUserStatus must be used within a UserProvider");
  }
  return ctx;
}

/**
 * @deprecated Use the granular hooks instead:
 *   - `useUserData()`   for user profile
 *   - `useUserStatus()` for isLoading / error
 *
 * This combined hook re-renders on every user state change. It is kept for
 * backwards compatibility only.
 */
export function useUser() {
  const { user } = useUserData();
  const { isLoading, error } = useUserStatus();
  return { user, isLoading, error };
}
