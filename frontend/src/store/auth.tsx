import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { api, setAuthToken } from "../lib/api";

export type AppRole = "admin" | "team_lead" | "team_member";

export type PresenceStatus =
  | "available"
  | "busy"
  | "do_not_disturb"
  | "be_right_back"
  | "away"
  | "offline";

export type CurrentUser = {
  id: number;
  name: string;
  employee_id?: string | null;
  email: string;
  phone?: string | null;
  designation?: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
  has_avatar?: boolean;
  status_presence?: PresenceStatus;
  status_message?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  website_url?: string | null;
  bio?: string | null;
  has_seen_issues_tour?: boolean;
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
  setUser: (user: CurrentUser) => void;
  refreshUser: () => Promise<CurrentUser | null>;
  avatarVersion: number;
  bumpAvatarVersion: () => void;
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
  const [avatarVersion, setAvatarVersion] = useState(0);

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

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        setAuthToken(token);
        const me = await api.get<CurrentUser>("/auth/me");
        if (!cancelled) {
          setUser(me);
          setAvatarVersion((v) => v + 1);
        }
      } catch {
        // Keep cached user; token may be invalid and protected routes will fail later.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Only refresh once when auth session hydrates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      avatarVersion,
      bumpAvatarVersion: () => setAvatarVersion((v) => v + 1),
      login: async (identifier, password) => {
        const response = await api.post<LoginResponse>("/auth/login", { identifier, password });
        setToken(response.access_token);
        setUser(response.user);
        setAvatarVersion((v) => v + 1);
      },
      logout: () => {
        setToken(null);
        setUser(null);
      },
      setUser: (next) => setUser(next),
      refreshUser: async () => {
        if (!token) return null;
        const me = await api.get<CurrentUser>("/auth/me");
        setUser(me);
        return me;
      },
    }),
    [token, user, avatarVersion],
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
