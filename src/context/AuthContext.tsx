"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { can, type Permission } from "@/lib/domain/permissions";
import type { User } from "@/lib/domain/types";
import * as api from "@/lib/mock-api/api";

export type SessionUser = Omit<User, "password">;

interface AuthState {
  user: SessionUser | null;
  ready: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => void;
  can: (permission: Permission) => boolean;
}

const SESSION_KEY = "insureflow:session";
const AuthContext = createContext<AuthState | null>(null);

function readSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY) ?? sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Storage only exists in the browser, so the session is restored after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(readSession());
    setReady(true);
  }, []);

  const login = useCallback(async (email: string, password: string, remember: boolean) => {
    const u = await api.login(email, password);
    try {
      (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(u));
    } catch {
      // Session stays in memory only.
    }
    setUser(u);
  }, []);

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, ready, login, logout, can: (p) => can(user?.role, p) }),
    [user, ready, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
