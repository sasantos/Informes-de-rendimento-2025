"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { AUTH_SESSION_DURATION_MS, AUTH_SESSION_STARTED_AT_KEY } from "@/lib/auth-session";

export type UserRole = "admin" | "usuario";

export interface UserProfile {
  email: string;
  role: UserRole;
  active: boolean;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const logoutTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearLogoutTimer = () => {
      if (logoutTimerRef.current) {
        window.clearTimeout(logoutTimerRef.current);
        logoutTimerRef.current = null;
      }
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearLogoutTimer();
      setUser(firebaseUser);
      if (firebaseUser) {
        const now = Date.now();
        const stored = Number(localStorage.getItem(AUTH_SESSION_STARTED_AT_KEY));
        const startedAt = Number.isFinite(stored) && stored > 0 ? stored : now;

        if (startedAt === now) {
          localStorage.setItem(AUTH_SESSION_STARTED_AT_KEY, String(now));
        }

        const elapsed = now - startedAt;
        if (elapsed >= AUTH_SESSION_DURATION_MS) {
          localStorage.removeItem(AUTH_SESSION_STARTED_AT_KEY);
          await signOut(auth);
          setProfile(null);
          setLoading(false);
          return;
        }

        const remainingMs = AUTH_SESSION_DURATION_MS - elapsed;
        logoutTimerRef.current = window.setTimeout(() => {
          localStorage.removeItem(AUTH_SESSION_STARTED_AT_KEY);
          void signOut(auth);
        }, remainingMs);

        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        setProfile(snap.exists() ? (snap.data() as UserProfile) : null);
      } else {
        localStorage.removeItem(AUTH_SESSION_STARTED_AT_KEY);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      clearLogoutTimer();
      unsubscribe();
    };
  }, []);

  const logout = async () => {
    if (logoutTimerRef.current) {
      window.clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    localStorage.removeItem(AUTH_SESSION_STARTED_AT_KEY);
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
