import { useRouter } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";

import { apiPost, getRefreshToken, setAccessToken, setRefreshToken } from "@/src/api/client";

export type User = {
  id: string;
  name: string;
  email: string;
  role: "Admin" | "Manager" | "Employee" | "Customer" | "Vendor";
  permissions?: Record<string, boolean>;
  company?: string | null;
  phone?: string | null;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
  can: (perm: string) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const rt = await getRefreshToken();
      if (rt) {
        try {
          const data = await apiPost("/auth/refresh", { refresh_token: rt });
          setAccessToken(data.access_token);
          await setRefreshToken(data.refresh_token);
          setUserState(data.user);
        } catch {
          await setRefreshToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await apiPost("/auth/login", { email, password });
    setAccessToken(data.access_token);
    await setRefreshToken(data.refresh_token);
    setUserState(data.user);
  };

  const logout = async () => {
    const rt = await getRefreshToken();
    try {
      if (rt) await apiPost("/auth/logout", { refresh_token: rt });
    } catch {}
    setAccessToken(null);
    await setRefreshToken(null);
    setUserState(null);
    router.replace("/login");
  };

  const can = (perm: string) => {
    if (!user) return false;
    if (user.role === "Admin") return true;
    return !!user.permissions?.[perm];
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser: setUserState, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
