'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Browser-side Supabase client.
 *
 * Deliberately uses the standard supabase-js client (localStorage-backed)
 * rather than the SSR cookie client.
 *
 * Why: cookie-based SSR auth requires the browser to persist a first-party
 * cookie. In embedded webviews, preview panes and privacy-restricted browsers
 * that write is silently refused, so sign-in appeared to succeed and then
 * vanished on the next navigation. localStorage is far more permissive, so the
 * session survives.
 *
 * The consequence is that the server can no longer read the session, so route
 * protection is enforced on the client (see AppShell). Patient data is still
 * protected server-side by row-level security, which verifies the JWT inside
 * PostgreSQL on every query - the browser cannot bypass that.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'kidneyguard-auth',
      },
    });
  }
  return browserClient;
}
