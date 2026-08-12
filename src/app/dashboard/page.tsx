'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { DashboardCard } from '@/components/DashboardCard';
import { PageHeader, Panel, StatusBadge, EmptyState } from '@/components/ui';
import { DonutChart, VBarChart } from '@/components/charts';
import {
  getAggregates,
  getClinicalStats,
  type Aggregates,
  type ClinicalStats,
} from '@/lib/ckdService';
import { useT } from '@/lib/i18n';
import {
  Activity,
  AlertTriangle,
  Target,
  Users,
  BrainCircuit,
  PieChart,
  BarChart2,
  Bell,
  Loader2,
  ClipboardList,
} from 'lucide-react';

const tierToStatus = (tier?: string | null) =>
  tier === 'Low Risk' ? 'LOW'
    : tier === 'Moderate Risk' ? 'MEDIUM'
    : tier === 'High Risk' ? 'HIGH'
    : tier === 'Critical Risk' ? 'VERY HIGH'
    : 'MEDIUM';

const relTime = (iso: string) => {
  if (!iso) return '—';
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} hr ago` : `${Math.round(h / 24)} d ago`;
};

export default function Dashboard() {
  const { t } = useT();
  const [agg, setAgg] = useState<Aggregates | null>(null);
  const [stats, setStats] = useState<ClinicalStats | null>(null);

  useEffect(() => {
    getAggregates().then(setAgg);
    getClinicalStats().then(setStats);
  }, []);

  const loading = !agg || !stats;
  const hasData = Boolean(agg && agg.total > 0);
  const recent = agg?.rows.slice(0, 5) ?? [];
  const alerts = recent.filter(
    (r) => r.tier === 'High Risk' || r.tier === 'Critical Risk'
  );

  return (
    <AppShell>
      <PageHeader
        title={t('nav.dashboard')}
        subtitle="Clinical overview of recorded assessments"
        actions={
          <Link
            href="/"
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg transition-all font-bold text-xs shadow-lg shadow-accent/20"
          >
            <BrainCircuit size={16} />
            New Assessment
          </Link>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-20">
          <Loader2 size={18} className="animate-spin" /> {t('common.loading')}
        </div>
      ) : !hasData ? (
        <Panel title="Clinical Overview" icon={Activity}>
          <EmptyState
            icon={ClipboardList}
            title="No assessments recorded yet"
            hint="Run a risk assessment and it will appear here. Every figure on this dashboard is calculated from your own saved assessments — nothing is simulated."
            action={
              <Link
                href="/"
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg font-bold text-xs"
              >
                <BrainCircuit size={15} /> Run first assessment
              </Link>
            }
          />
        </Panel>
      ) : (
        <>
          {/* Caseload cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6">
            <DashboardCard
              title="Total Assessments"
              value={String(agg!.total)}
              subtitle="recorded to date"
              icon={Activity}
            />
            <DashboardCard
              title="Needs Referral"
              value={String(agg!.flagged)}
              subtitle={`${Math.round((agg!.flagged / agg!.total) * 100)}% of assessments`}
              icon={AlertTriangle}
            />
            <DashboardCard
              title="Patients Tracked"
              value={String(stats!.patients)}
              subtitle="with saved history"
              icon={Users}
            />
            <DashboardCard
              title="Mean Risk Score"
              value={`${agg!.meanRisk}%`}
              subtitle="across all assessments"
              icon={Target}
            />
          </div>

          {/* Distribution + volume */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Panel title="Risk Distribution" icon={PieChart}>
              <DonutChart data={agg!.byTier} />
            </Panel>
            <Panel title="Assessments per Month" icon={BarChart2}>
              {agg!.monthly.some((m) => m.value > 0) ? (
                <VBarChart data={agg!.monthly} />
              ) : (
                <EmptyState title="Not enough history yet" hint="Monthly volume appears once assessments span more than one month." />
              )}
            </Panel>
          </div>

          {/* Alerts */}
          <Panel title="Patients Needing Attention" icon={Bell} className="mb-6">
            {alerts.length === 0 ? (
              <EmptyState
                title="No high-risk patients in recent assessments"
                hint="Assessments at High or Critical risk are listed here for follow-up."
              />
            ) : (
              <div className="flex flex-col gap-2">
                {alerts.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-3 bg-red-50 border border-red-100 rounded-xl p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {r.patient_name || 'Unnamed patient'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {r.age != null ? `${r.age} yrs · ` : ''}
                        {relTime(r.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-bold text-red-600">
                        {r.risk_probability != null ? `${r.risk_probability}%` : '—'}
                      </span>
                      <StatusBadge status={tierToStatus(r.tier)} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Recent */}
          <Panel title="Recent Assessments" icon={ClipboardList}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[620px]">
                <thead className="text-[10px] text-slate-500 uppercase font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-3">Patient</th>
                    <th className="px-4 py-3 text-center">Age</th>
                    <th className="px-4 py-3 text-center">Risk</th>
                    <th className="px-4 py-3 text-center">Tier</th>
                    <th className="px-4 py-3 text-right">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recent.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {r.patient_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">{r.age ?? '—'}</td>
                      <td className="px-4 py-3 text-center font-bold text-slate-900">
                        {r.risk_probability != null ? `${r.risk_probability}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={tierToStatus(r.tier)} />
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-400">
                        {relTime(r.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </AppShell>
  );
}
