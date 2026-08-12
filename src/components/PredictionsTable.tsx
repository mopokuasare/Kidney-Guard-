'use client';

import { useEffect, useState } from 'react';
import { BarChart2, Loader2 } from 'lucide-react';
import { StatusBadge } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { getRecentPredictions, type PredictionRow } from '@/lib/ckdService';

const tierToStatus = (tier?: string | null): string => {
  switch (tier) {
    case 'Low Risk': return 'LOW';
    case 'Moderate Risk': return 'MEDIUM';
    case 'High Risk': return 'HIGH';
    case 'Critical Risk': return 'VERY HIGH';
    default: return 'MEDIUM';
  }
};

const relTime = (iso: string): string => {
  if (!iso) return 'sample';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} d ago`;
};

export const PredictionsTable = () => {
  const { t } = useT();
  const [rows, setRows] = useState<PredictionRow[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    // No invented rows: without a database there is simply nothing to show.
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    let active = true;
    getRecentPredictions(10).then((data) => {
      if (!active) return;
      setRows(data.length ? data : []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mt-6">
      <div className="bg-sidebar-bg p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-bold">
          <BarChart2 size={18} className="text-slate-400" />
          <span className="text-sm">{t('predict.recent')}</span>
        </div>
        <button className="text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider">
          {t('common.viewAll')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-12">
          <Loader2 size={16} className="animate-spin" /> {t('common.loading')}
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-12">{t('common.none')}</div>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1">
          <table className="w-full text-sm text-left min-w-[800px]">
            <thead className="text-[10px] text-slate-500 uppercase font-bold bg-white border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">Name</th>
                <th className="px-6 py-4 whitespace-nowrap text-center">Age</th>
                <th className="px-6 py-4 whitespace-nowrap text-center">Creatinine</th>
                <th className="px-6 py-4 whitespace-nowrap text-center">BUN</th>
                <th className="px-6 py-4 whitespace-nowrap text-center">Risk Score</th>
                <th className="px-6 py-4 whitespace-nowrap text-center">Status</th>
                <th className="px-6 py-4 whitespace-nowrap text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900 leading-tight">
                    <div className="max-w-[140px] truncate">{r.patient_name || '—'}</div>
                  </td>
                  <td className="px-6 py-4 text-center text-slate-600">{r.age ?? '—'}</td>
                  <td className="px-6 py-4 text-center text-slate-600">{r.inputs?.serum_creatinine ?? '—'}</td>
                  <td className="px-6 py-4 text-center text-slate-600">{r.inputs?.blood_urea_nitrogen ?? '—'}</td>
                  <td className="px-6 py-4 text-center font-bold text-slate-900">
                    {r.risk_probability != null ? `${r.risk_probability}%` : '—'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <StatusBadge status={tierToStatus(r.tier)} />
                  </td>
                  <td className="px-6 py-4 text-right text-xs text-slate-400">{relTime(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
