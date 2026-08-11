'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';

export type Role = 'admin' | 'doctor' | 'nurse';

export interface Profile {
  id: string;
  full_name: string | null;
  role: Role;
}

interface AuthCtx {
  user: User | null;
  profile: Profile | null;
  role: Role | null;
  /** Email of the signed-in clinician, from the server or the client session. */
  email: string | null;
  /** True only when there is genuinely no signed-in user. */
  signedIn: boolean;
  loading: boolean;
  configured: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  profile: null,
  role: null,
  email: null,
  signedIn: false,
  loading: true,
  configured: false,
  signOut: async () => {},
});

export function AuthProvider({
  children,
  initialEmail = null,
  initialProfile = null,
}: {
  children: React.ReactNode;
  /** Resolved server-side in the root layout; authoritative on first paint. */
  initialEmail?: string | null;
  initialProfile?: Profile | null;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [email, setEmail] = useState<string | null>(initialEmail);
  // If the server already resolved a user there is nothing to wait for.
  const [loading, setLoading] = useState(!initialEmail);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      // Auth not configured — app runs without login.
      setLoading(false);
      return;
    }

    let active = true;

    const loadProfile = async (uid: string) => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', uid)
        .single();
      if (active) setProfile((data as Profile) ?? null);
    };

    /**
     * getSession() reads the session straight from the cookie, so the UI knows
     * who is signed in immediately. getUser() would instead make a network
     * round-trip to Supabase, and while that was in flight (or if it failed)
     * `user` stayed null and the sidebar rendered a "Sign in" link to an
     * already-signed-in clinician. The session is still validated server-side
     * by the middleware on every request, so trusting the cookie for UI state
     * is safe.
     */
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        setEmail(sessionUser.email ?? null);
        loadProfile(sessionUser.id);
      }
      // Never downgrade state the server already established: if the browser
      // client cannot see the cookie but the server could, the clinician is
      // still signed in and must not be shown a "Sign in" link.
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (session?.user) {
        setEmail(session.user.email ?? null);
        loadProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        // Only an explicit sign-out clears the server-seeded state.
        setEmail(null);
        setProfile(null);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = getSupabaseBrowser();
    if (supabase) await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setEmail(null);
    // Full reload so the server re-renders the layout without a session,
    // rather than leaving the server-seeded state behind.
    if (typeof window !== 'undefined') window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role ?? null,
        email,
        // Either source proves a session: the server-rendered layout or the
        // browser client.
        signedIn: Boolean(email || user),
        loading,
        configured: isSupabaseConfigured,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
