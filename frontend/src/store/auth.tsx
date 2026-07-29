import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { api, setAuthToken } from "../lib/api";

export type AppRole = "admin" | "team_lead" | "team_member";

export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: AppRole;
  is_active: boolean;
  created_at: string;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
  user: CurrentUser;
};

type AuthContextValue = {
  token: string | null;
  user: CurrentUser | null;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "amc-auth-token";
const USER_KEY = "amc-auth-user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<CurrentUser | null>(() => {
    const value = localStorage.getItem(USER_KEY);
    return value ? (JSON.parse(value) as CurrentUser) : null;
  });

  useEffect(() => {
    setAuthToken(token);
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [user]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      login: async (identifier, password) => {
        const response = await api.post<LoginResponse>("/auth/login", { identifier, password });
        setToken(response.access_token);
        setUser(response.user);
      },
      logout: () => {
        setToken(null);
        setUser(null);
      },
    }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
