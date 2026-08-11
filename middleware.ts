import { NextResponse, type NextRequest } from 'next/server';

/**
 * Route protection is enforced on the client (see AppShell), not here.
 *
 * This middleware used to gate every navigation on a Supabase session cookie.
 * That only works if the browser persists the cookie, and in embedded webviews,
 * preview panes and privacy-restricted browsers the write is silently refused -
 * so a successful sign-in was discarded and the next page change bounced the
 * clinician back to /login. The session now lives in localStorage, which the
 * server cannot read, so gating here would reject everyone.
 *
 * This is not a weakening of data security: every patient record is protected
 * by row-level security in PostgreSQL, which verifies the JWT on every query
 * regardless of what the browser is allowed to render.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
