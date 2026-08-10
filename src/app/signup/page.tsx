'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n';
import type { Role } from '@/lib/auth';
import { AuthShell, Field } from '@/app/login/page';

export default function SignupPage() {
  const { t } = useT();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('doctor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setError('Authentication is not configured yet. Add your Supabase keys to enable sign up.');
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    // If email confirmation is on, there's no active session yet.
    if (data.session) {
      router.push('/');
      router.refresh();
    } else {
      setNotice(t('auth.checkEmail'));
    }
  };

  return (
    <AuthShell subtitle={t('auth.signUpSubtitle')}>
      {!isSupabaseConfigured && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          Supabase isn&apos;t configured yet, so sign up is disabled. See SUPABASE_SETUP.md.
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={t('auth.fullName')} value={fullName} onChange={setFullName} autoComplete="name" required />
        <Field label={t('auth.email')} type="email" value={email} onChange={setEmail} autoComplete="email" required />
        <Field label={t('auth.password')} type="password" value={password} onChange={setPassword} autoComplete="new-password" required />

        <label className="block">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{t('auth.role')}</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
          >
            <option value="doctor">{t('auth.role.doctor')}</option>
            <option value="nurse">{t('auth.role.nurse')}</option>
            <option value="admin">{t('auth.role.admin')}</option>
          </select>
        </label>

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
        {notice && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">{notice}</p>}

        <button
          type="submit"
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-sidebar-bg hover:bg-slate-800 disabled:opacity-60 text-white py-3 rounded-xl font-bold transition-all"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
          {busy ? t('auth.creating') : t('auth.signUp')}
        </button>
      </form>
      <p className="text-xs text-slate-500 mt-6 text-center">
        {t('auth.haveAccount')}{' '}
        <Link href="/login" className="text-accent font-bold hover:underline">
          {t('auth.signIn')}
        </Link>
      </p>
    </AuthShell>
  );
}
