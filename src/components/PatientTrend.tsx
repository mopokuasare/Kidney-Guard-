'use client';

import { useEffect, useState } from 'react';
import { LineChart, Loader2 } from 'lucide-react';
import { Panel, StatPill } from '@/components/ui';
import { Sparkline } from '@/components/charts';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getDistinctPatients, getPatientHistory, type PredictionRow } from '@/lib/ckdService';

export const PatientTrend = () => {
  const [patients, setPatients] = useState<string[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [history, setHistory] = useState<PredictionRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getDistinctPatients().then((list) => {
      setPatients(list);
      if (list.length) setSelected(list[0]);
    });
  }, []);

  useEffect(() => {
    if (!selected) {
      setHistory([]);
      return;
    }
    setLoading(true);
    let active = true;
    getPatientHistory(selected).then((rows) => {
      if (!active) return;
      setHistory(rows);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [selected]);

  if (!isSupabaseConfigured) {
    return (
      <Panel title="Patient Risk Trend" icon={LineChart} className="mb-6">
        <p className="text-sm text-slate-500">
          Connect Supabase to track each patient&apos;s CKD risk over time. Once configured, every
          prediction is saved and charted here. See SUPABASE_SETUP.md.
        </p>
      </Panel>
    );
  }

  const riskPoints = history.map((h) => Number(h.risk_probability ?? 0));
  const egfrPoints = history.map((h) => Number(h.egfr ?? 0)).filter((v) => v > 0);
  const latest = history[history.length - 1];
  const first = history[0];
  const delta =
    latest && first && latest.risk_probability != null && first.risk_probability != null
      ? Number(latest.risk_probability) - Number(first.risk_probability)
      : null;

  return (
    <Panel
      title="Patient Risk Trend"
      icon={LineChart}
      className="mb-6"
      action={
        patients.length > 0 && (
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="bg-slate-700 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer max-w-[180px]"
          >
            {patients.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )
      }
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-10">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : patients.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">
          No saved predictions yet. Run a prediction with a patient name to start building a trend.
        </p>
      ) : history.length < 2 ? (
        <p className="text-sm text-slate-500 py-6 text-center">
          Only one record for <span className="font-bold text-slate-700">{selected}</span>. At least two
          predictions are needed to show a trend.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatPill label="Assessments" value={`${history.length}`} tone="blue" />
            <StatPill label="Latest Risk" value={`${latest?.risk_probability ?? '—'}%`} tone={Number(latest?.risk_probability) >= 60 ? 'red' : 'emerald'} />
            <StatPill label="Latest eGFR" value={latest?.egfr != null ? `${latest.egfr}` : '—'} tone="slate" />
            <StatPill
              label="Risk Change"
              value={delta == null ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(0)}%`}
              tone={delta != null && delta > 0 ? 'red' : 'emerald'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">CKD Risk (%) over time</span>
                <span className={`text-xs font-bold ${delta != null && delta > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                  {delta == null ? '' : delta > 0 ? '↑ rising' : '↓ improving'}
                </span>
              </div>
              <Sparkline points={riskPoints} color="#ef4444" />
            </div>
            {egfrPoints.length >= 2 && (
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">eGFR over time</span>
                </div>
                <Sparkline points={egfrPoints} color="#3b82f6" />
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 mt-4 pt-4 border-t border-slate-100">
            {history.length} assessments · from {new Date(first.created_at).toLocaleDateString()} to{' '}
            {new Date(latest.created_at).toLocaleDateString()}
          </p>
        </>
      )}
    </Panel>
  );
};
