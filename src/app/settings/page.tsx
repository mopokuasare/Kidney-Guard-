'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader, Panel, EmptyState } from '@/components/ui';
import { useT, LANGUAGES, type Lang } from '@/lib/i18n';
import { useAuth, type Role } from '@/lib/auth';
import { getSupabaseBrowser, isSupabaseConfigured } from '@/lib/supabase/client';
import {
  Users,
  BrainCircuit,
  ShieldCheck,
  Globe,
  LogOut,
  Loader2,
  Save,
  CheckCircle2,
  Server,
} from 'lucide-react';

const ROLE_STYLES: Record<string, string> = {
  admin: 'bg-orange-100 text-orange-700',
  doctor: 'bg-blue-100 text-blue-700',
  nurse: 'bg-emerald-100 text-emerald-700',
};

interface TeamMember {
  id: string;
  full_name: string | null;
  role: Role;
}

export default function Settings() {
  const { t, lang, setLang } = useT();
  const { profile, email, role, signOut, configured } = useAuth();

  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamMember[] | null>(null);

  useEffect(() => {
    setName(profile?.full_name ?? '');
  }, [profile?.full_name]);

  // Any signed-in clinician can read the team list (see schema.sql policies).
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    if (!supabase) {
      setTeam([]);
      return;
    }
    supabase
      .from('profiles')
      .select('id, full_name, role')
      .order('created_at', { ascending: true })
      .then(({ data }) => setTeam((data as TeamMember[]) ?? []));
  }, []);

  const saveProfile = async () => {
    const supabase = getSupabaseBrowser();
    if (!supabase || !profile?.id) return;
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: name.trim() || null })
      .eq('id', profile.id);
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    setSaved(true);
    setTeam((prev) =>
      prev?.map((m) => (m.id === profile.id ? { ...m, full_name: name.trim() || null } : m)) ?? prev
    );
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <AppShell>
      <PageHeader title={t('nav.settings')} subtitle="Your account, language and system information" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* ── Your account ─────────────────────────────────────── */}
        <Panel title="Your Account" icon={ShieldCheck}>
          {!configured ? (
            <EmptyState title="Authentication is not configured" hint="Account settings appear once Supabase is connected." />
          ) : (
            <>
              <label className="block mb-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {t('auth.fullName')}
                </span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent"
                />
              </label>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {t('auth.email')}
                  </span>
                  <p className="text-sm text-slate-700 mt-1.5 truncate">{email || '—'}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {t('auth.role')}
                  </span>
                  <p className="mt-1.5">
                    {role ? (
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded ${ROLE_STYLES[role]}`}>
                        {t(`auth.role.${role}`)}
                      </span>
                    ) : (
                      '—'
                    )}
                  </p>
                </div>
              </div>

              {saveError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                  {saveError}
                </p>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={saveProfile}
                  disabled={saving || !profile?.id}
                  className="flex items-center gap-2 bg-sidebar-bg hover:bg-slate-800 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-colors"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save changes
                </button>
                {saved && (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                    <CheckCircle2 size={14} /> Saved
                  </span>
                )}
              </div>

              <button
                onClick={signOut}
                className="mt-5 pt-5 border-t border-slate-100 w-full flex items-center justify-center gap-2 text-red-600 hover:text-red-700 text-xs font-bold"
              >
                <LogOut size={14} /> {t('nav.signOut')}
              </button>
            </>
          )}
        </Panel>

        {/* ── Language ─────────────────────────────────────────── */}
        <Panel title={t('nav.language')} icon={Globe}>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Applies immediately across the interface and is remembered in this browser.
          </p>
          <div className="flex flex-col gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code as Lang)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors ${
                  lang === l.code
                    ? 'border-accent bg-blue-50 text-slate-900 font-bold'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {l.label}
                {lang === l.code && <CheckCircle2 size={16} className="text-accent" />}
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── Team ───────────────────────────────────────────────── */}
      <Panel title="Clinical Team" icon={Users} className="mb-6">
        {team === null ? (
          <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-8">
            <Loader2 size={16} className="animate-spin" /> {t('common.loading')}
          </div>
        ) : team.length === 0 ? (
          <EmptyState title="No accounts to show" hint="Team members appear here once they create an account." />
        ) : (
          <div className="flex flex-col divide-y divide-slate-100">
            {team.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-sm shrink-0">
                    {(m.full_name || '?').charAt(0).toUpperCase()}
                  </div>
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {m.full_name || 'Unnamed user'}
                    {m.id === profile?.id && (
                      <span className="text-[10px] text-slate-400 font-normal ml-2">(you)</span>
                    )}
                  </p>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded shrink-0 ${ROLE_STYLES[m.role] ?? 'bg-slate-100 text-slate-600'}`}>
                  {t(`auth.role.${m.role}`)}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-slate-400 mt-4 pt-4 border-t border-slate-100 leading-relaxed">
          Roles are assigned at signup and enforced by row-level security in the database.
          Only an administrator can delete another clinician&apos;s records.
        </p>
      </Panel>

      {/* ── System ─────────────────────────────────────────────── */}
      <Panel title="System" icon={Server}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <Row label="Model" value="Calibrated stacking ensemble (RF + GB + XGBoost → LR)" icon={BrainCircuit} />
          <Row label="Training data" value="CDC NHANES 2021–2023 · 6,326 patients" />
          <Row label="Clinical standard" value="KDIGO 2024 · CKD-EPI 2021 eGFR" />
          <Row label="Decision threshold" value="0.1298 (screening sensitivity)" />
          <Row label="Explainability" value="SHAP + LIME, per patient" />
          <Row label="Prediction service" value={process.env.NEXT_PUBLIC_CKD_API_URL || 'not configured'} />
          <Row label="Database" value={isSupabaseConfigured ? 'Supabase PostgreSQL · connected' : 'not configured'} />
        </div>
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4 leading-relaxed">
          Decision support only. Outputs must be confirmed by a qualified clinician and are not a
          diagnosis. The model has not been externally validated on an independent clinical population.
        </p>
      </Panel>
    </AppShell>
  );
}

const Row = ({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) => (
  <div className="flex items-start gap-2">
    {Icon && <Icon size={14} className="text-slate-400 shrink-0 mt-0.5" />}
    <div className="min-w-0">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-slate-700 break-words">{value}</p>
    </div>
  </div>
);
