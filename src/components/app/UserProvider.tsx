"use client";
import * as React from "react";
import type { PublicUser } from "@/lib/types";
import { api } from "@/lib/api-client";

type Ctx = {
  user: PublicUser;
  setUser: (u: PublicUser) => void;
  /** Re-fetch /api/auth/me (e.g. after spending credits or saving settings). */
  refresh: () => Promise<void>;
  /** Optimistically update the visible credit balance. */
  setCredits: (n: number) => void;
};

const UserContext = React.createContext<Ctx | null>(null);

export function UserProvider({ initialUser, children }: { initialUser: PublicUser; children: React.ReactNode }) {
  const [user, setUser] = React.useState<PublicUser>(initialUser);
  const refresh = React.useCallback(async () => {
    try {
      const r = await api.get<{ user: PublicUser }>("/auth/me");
      if (r?.user) setUser(r.user);
    } catch {
      /* 401 handled by api client */
    }
  }, []);
  const setCredits = React.useCallback((n: number) => setUser((u) => ({ ...u, credits: n })), []);
  return <UserContext.Provider value={{ user, setUser, refresh, setCredits }}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = React.useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used inside <UserProvider>");
  return ctx;
}
