/**
 * AuthProvider — React context for Supabase auth session, sign-in/sign-up/sign-out.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import { registerPushToken } from "./pushNotifications";

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  loading: true,
  signIn: async () => ({ error: "not_initialized" }),
  signUp: async () => ({ error: "not_initialized" }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const triggerSyncOnSignIn = () => {
    setTimeout(() => {
      try {
        const { processSyncQueue } = require('./syncQueue');
        processSyncQueue().catch((e: Error) =>
          console.warn('[AuthProvider] Auto-sync on sign-in failed:', e?.message)
        );
      } catch (e) { console.warn('[AuthProvider] triggerSyncOnSignIn failed:', e); }
    }, 1000);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        triggerSyncOnSignIn();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (_event === 'SIGNED_IN' && session?.user) {
        triggerSyncOnSignIn();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.id) {
      registerPushToken(user.id, supabase);
    }
  }, [user?.id]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? { error: error.message } : {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
