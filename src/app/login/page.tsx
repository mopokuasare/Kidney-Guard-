'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n';

function LoginForm() {
  const { t } = useT();
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setError('Authentication is not configured yet. Add your Supabase keys to enable login.');
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setBusy(false);
      // Supabase returns this when the account exists but the confirmation link
      // was never followed. The raw message doesn't say what to do about it.
      setError(
        /email not confirmed/i.test(error.message)
          ? 'This account has not been confirmed yet. Open the confirmation link sent to your email, ' +
            'or ask an administrator to confirm the account in Supabase.'
          : error.message
      );
      return;
    }

    /**
     * Navigating without checking that a session actually persisted turns a
     * failed sign-in into a silent loop: the redirect lands on a protected
     * page, the middleware sees no session cookie, and bounces straight back
     * to this form with no explanation. Verify first, and say so if it failed.
     */
    const { data: check } = await supabase.auth.getSession();
    setBusy(false);
    if (!check.session) {
      setError(
        'Signed in, but the session could not be stored in this browser. ' +
          'Check that cookies are enabled for this site and that you are not in a ' +
          'private window with cookies blocked, then try again.'
      );
      return;
    }

    router.push(redirect);
    router.refresh();
  };

  return (
    <AuthShell subtitle={t('auth.signInSubtitle')}>
      {!isSupabaseConfigured && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          Supabase isn&apos;t configured yet, so login is disabled. See SUPABASE_SETUP.md.
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={t('auth.email')} type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <Field label={t('auth.password')} type="password" value={password} onChange={setPassword} autoComplete="current-password" required />

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-sidebar-bg hover:bg-slate-800 disabled:opacity-60 text-white py-3 rounded-xl font-bold transition-all"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
          {busy ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>
      <p className="text-xs text-slate-500 mt-6 text-center">
        {t('auth.noAccount')}{' '}
        <Link href="/signup" className="text-accent font-bold hover:underline">
          {t('auth.signUp')}
        </Link>
      </p>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell subtitle="…"><div /></AuthShell>}>
      <LoginForm />
    </Suspense>
  );
}

/* ── shared auth UI ─────────────────────────────────────────────────────── */

export function AuthShell({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-main-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 justify-center mb-6">
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center text-white font-bold text-lg">K</div>
          <div>
            <h1 className="text-slate-900 font-bold text-xl leading-tight">KidneyGuard</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Clinical AI</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <p className="text-sm text-slate-500 mb-6 text-center">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  type = 'text',
  value,
  onChange,
  autoComplete,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
      />
    </label>
  );
}
