'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { PageHeader, Panel, StatPill, StatusBadge, Disclaimer } from '@/components/ui';
import { Sparkline } from '@/components/charts';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getDistinctPatients, getPatientHistory, type PredictionRow } from '@/lib/ckdService';
import { Users, Search, History, Loader2, ClipboardList, ChevronRight } from 'lucide-react';

const tierToStatus = (tier?: string | null): string => {
  switch (tier) {
    case 'Low Risk': return 'LOW';
    case 'Moderate Risk': return 'MEDIUM';
    case 'High Risk': return 'HIGH';
    case 'Critical Risk': return 'VERY HIGH';
    default: return 'MEDIUM';
  }
};

export default function PatientRecords() {
  const [patients, setPatients] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [history, setHistory] = useState<PredictionRow[]>([]);
  const [query, setQuery] = useState('');
  const [loadingList, setLoadingList] = useState(isSupabaseConfigured);
  const [loadingHist, setLoadingHist] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getDistinctPatients().then((list) => {
      setPatients(list);
      if (list.length) setSelected(list[0]);
      setLoadingList(false);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoadingHist(true);
    let active = true;
    getPatientHistory(selected).then((rows) => {
      if (!active) return;
      setHistory(rows);
      setLoadingHist(false);
    });
    return () => { active = false; };
  }, [selected]);

  const filtered = useMemo(
    () => patients.filter((p) => p.toLowerCase().includes(query.toLowerCase())),
    [patients, query]
  );

  const latest = history[history.length - 1];
  const riskPoints = history.map((h) => Number(h.risk_probability ?? 0));

  return (
    <AppShell>
      <PageHeader title="Patient Records" subtitle="Saved assessments, clinical history and follow-up" />

      {!isSupabaseConfigured ? (
        <Panel title="Patient Records" icon={Users}>
          <p className="text-sm text-slate-500">
            Connect Supabase to store and browse patient assessments. Once configured, every prediction
            you run (with a patient name) is saved here automatically. See SUPABASE_SETUP.md.
          </p>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient list */}
          <div className="lg:col-span-1">
            <Panel title="Patients" icon={Users}>
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name…"
                  className="w-full bg-input-bg border border-transparent hover:border-slate-300 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-900 outline-none transition-all"
                />
              </div>

              {loadingList ? (
                <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-10">
                  <Loader2 size={16} className="animate-spin" /> Loading…
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  {patients.length === 0 ? 'No saved patients yet. Run a prediction with a patient name.' : 'No matches.'}
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {filtered.map((name) => (
                    <button
                      key={name}
                      onClick={() => setSelected(name)}
                      className={`flex items-center justify-between gap-2 rounded-xl p-3 text-left transition-all border ${
                        selected === name ? 'bg-blue-50 border-accent/40' : 'bg-white border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-sm font-bold text-slate-900 truncate">{name}</span>
                      <ChevronRight size={14} className="text-slate-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          {/* Patient detail */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            {!selected ? (
              <Panel title="Select a patient" icon={ClipboardList}>
                <p className="text-sm text-slate-500">Choose a patient from the list to see their assessment history.</p>
              </Panel>
            ) : loadingHist ? (
              <Panel title={selected} icon={ClipboardList}>
                <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-10">
                  <Loader2 size={16} className="animate-spin" /> Loading history…
                </div>
              </Panel>
            ) : (
              <>
                <Panel
                  title={selected}
                  icon={ClipboardList}
                  action={latest?.tier ? <StatusBadge status={tierToStatus(latest.tier)} /> : undefined}
                >
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatPill label="Assessments" value={`${history.length}`} tone="blue" />
                    <StatPill
                      label="Latest Risk"
                      value={latest?.risk_probability != null ? `${latest.risk_probability}%` : '—'}
                      tone={Number(latest?.risk_probability) >= 60 ? 'red' : Number(latest?.risk_probability) >= 30 ? 'orange' : 'emerald'}
                    />
                    <StatPill label="Age" value={latest?.age != null ? `${latest.age} yrs` : '—'} />
                    <StatPill label="Last Assessed" value={latest ? new Date(latest.created_at).toLocaleDateString() : '—'} />
                  </div>
                </Panel>

                {history.length >= 2 && (
                  <Panel title="Risk History" icon={History}>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className="text-2xl font-bold text-slate-900">{latest?.risk_probability}%</span>
                      <span className="text-xs font-bold text-slate-400">
                        {history.length} assessments
                      </span>
                    </div>
                    <Sparkline points={riskPoints} color="#f97316" />
                  </Panel>
                )}

                <Panel title="Assessment Log" icon={ClipboardList}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left min-w-[420px]">
                      <thead className="text-[10px] text-slate-500 uppercase font-bold border-b border-slate-100">
                        <tr>
                          <th className="py-3 pr-4">Date</th>
                          <th className="py-3 pr-4 text-center">Risk</th>
                          <th className="py-3 pr-4 text-center">Level</th>
                          <th className="py-3 text-center">Class</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[...history].reverse().map((h) => (
                          <tr key={h.id}>
                            <td className="py-3 pr-4 text-slate-600">{new Date(h.created_at).toLocaleString()}</td>
                            <td className="py-3 pr-4 text-center font-bold text-slate-900">
                              {h.risk_probability != null ? `${h.risk_probability}%` : '—'}
                            </td>
                            <td className="py-3 pr-4 text-center"><StatusBadge status={tierToStatus(h.tier)} /></td>
                            <td className="py-3 text-center text-xs text-slate-500">{h.predicted_class ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>

                <Disclaimer />
              </>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
