import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Temporary diagnostic for the "asked to sign in again" problem.
 *
 * Reports ONLY cookie NAMES and booleans - never cookie values, tokens, keys or
 * the user's email - so it is safe to open in a browser and paste the output.
 * Delete this route once the session issue is resolved.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const store = await cookies();
  const all = store.getAll();
  const supabaseCookies = all
    .filter((c) => c.name.startsWith('sb-'))
    .map((c) => ({ name: c.name, length: c.value?.length ?? 0 }));

  const report: Record<string, unknown> = {
    server_env: {
      NEXT_PUBLIC_SUPABASE_URL_present: Boolean(url),
      NEXT_PUBLIC_SUPABASE_ANON_KEY_present: Boolean(key),
      url_host: url ? new URL(url).host : null,
    },
    cookies: {
      total_received: all.length,
      supabase_cookies: supabaseCookies,
      supabase_cookie_count: supabaseCookies.length,
    },
  };

  if (!url || !key) {
    report.verdict =
      'Supabase env vars are NOT set on the server. The server can never read a session. ' +
      'Add them to the Production environment in Vercel and redeploy.';
    return NextResponse.json(report, { status: 200 });
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: () => {
        /* read-only diagnostic */
      },
    },
  });

  try {
    const { data, error } = await supabase.auth.getUser();
    report.get_user = {
      resolved_a_user: Boolean(data?.user),
      error: error ? error.message : null,
    };
    report.verdict = data?.user
      ? 'OK - the server CAN read your session. If the sidebar still shows "Sign in", the problem is client-side rendering, not the session.'
      : supabaseCookies.length === 0
      ? 'No Supabase cookies reached the server. The session is not being written at sign-in, or is being blocked before it is sent back.'
      : 'Supabase cookies arrived but did not resolve to a user - the token is being rejected (expired, wrong project, or malformed).';
  } catch (e) {
    report.get_user = { resolved_a_user: false, error: String(e) };
    report.verdict = 'getUser() threw - the server could not reach Supabase.';
  }

  return NextResponse.json(report, { status: 200 });
}
