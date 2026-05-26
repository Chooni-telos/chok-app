"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { UserStats } from "@/lib/types";

interface AuthState {
  token: string | null;
  user: UserStats | null;
  loading: boolean;
  login: (provider: string, code: string, redirectUri?: string, password?: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (t: string) => {
    try {
      const data = await api.get<UserStats>("/me", t);
      setUser(data);
      setToken(t);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("access_token");
    if (saved) {
      loadUser(saved).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [loadUser]);

  const login = useCallback(async (provider: string, code: string, redirectUri?: string, password?: string) => {
    const data = await api.post<{
      access_token: string;
      refresh_token: string;
      needs_nickname: boolean;
      user: { id: string; nickname: string | null; preferred_language: string };
    }>("/auth/login", { provider, code, redirect_uri: redirectUri, password });

    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    setToken(data.access_token);
    await loadUser(data.access_token);
  }, [loadUser]);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setToken(null);
    setUser(null);
  }, []);

  const refreshToken = useCallback(async () => {
    const rt = localStorage.getItem("refresh_token");
    if (!rt) return;
    try {
      const data = await api.post<{ access_token: string; refresh_token: string }>("/auth/refresh", {
        refresh_token: rt,
      });
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      setToken(data.access_token);
    } catch {
      logout();
    }
  }, [logout]);

  const value = useMemo(
    () => ({ token, user, loading, login, logout, refresh: refreshToken }),
    [token, user, loading, login, logout, refreshToken],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
