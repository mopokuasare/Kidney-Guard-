'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PageHeader, Panel, StatusBadge, EmptyState } from '@/components/ui';
import {
  getAggregates,
  FEATURE_ORDER,
  FEATURE_LABELS,
  type Aggregates,
  type PredictionRow,
  type PatientFeatures,
} from '@/lib/ckdService';
import { useT } from '@/lib/i18n';
import {
  FileSpreadsheet,
  Users,
  Phone,
  Loader2,
  ClipboardList,
  BrainCircuit,
  Download,
  CalendarClock,
} from 'lucide-react';

/** Quote a CSV cell so commas, quotes and newlines can't break the columns. */
const csvCell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const downloadCsv = (filename: string, header: string[], rows: unknown[][]) => {
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const stamp = () => new Date().toISOString().slice(0, 10);

const tierToStatus = (tier?: string | null) =>
  tier === 'Low Risk' ? 'LOW'
    : tier === 'Moderate Risk' ? 'MEDIUM'
    : tier === 'High Risk' ? 'HIGH'
    : tier === 'Critical Risk' ? 'VERY HIGH'
    : 'MEDIUM';

export default function Reports() {
  const { t } = useT();
  const [agg, setAgg] = useState<Aggregates | null>(null);

  useEffect(() => {
    getAggregates().then(setAgg);
  }, []);

  const rows: PredictionRow[] = agg?.rows ?? [];
  const hasData = rows.length > 0;

  const highRisk = rows.filter(
    (r) => r.tier === 'High Risk' || r.tier === 'Critical Risk'
  );

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const thisMonth = rows.filter((r) => new Date(r.created_at) >= monthStart);

  /* ── Exports (all built from saved assessments) ────────────────── */

  const exportFullLog = () => {
    const header = [
      'Assessed At', 'Patient', 'Age', 'Risk %', 'Risk Tier', 'Urgency',
      ...FEATURE_ORDER.map((f) => FEATURE_LABELS[f]),
    ];
    downloadCsv(
      `kidneyguard_assessments_${stamp()}.csv`,
      header,
      rows.map((r) => [
        new Date(r.created_at).toLocaleString(),
        r.patient_name ?? '',
        r.age ?? '',
        r.risk_probability ?? '',
        r.tier ?? '',
        r.predicted_class ?? '',
        ...FEATURE_ORDER.map((f) => r.inputs?.[f as keyof PatientFeatures] ?? ''),
      ])
    );
  };

  const exportFollowUp = () => {
    downloadCsv(
      `kidneyguard_followup_${stamp()}.csv`,
      ['Patient', 'Age', 'Risk %', 'Risk Tier', 'Assessed At', 'Recommended Action'],
      highRisk.map((r) => [
        r.patient_name ?? '',
        r.age ?? '',
        r.risk_probability ?? '',
        r.tier ?? '',
        new Date(r.created_at).toLocaleString(),
        r.tier === 'Critical Risk'
          ? 'Urgent nephrology referral'
          : 'Nephrology referral; full renal workup',
      ])
    );
  };

  const exportMonthly = () => {
    downloadCsv(
      `kidneyguard_monthly_${stamp()}.csv`,
      ['Metric', 'Value'],
      [
        ['Period', monthStart.toLocaleString(undefined, { month: 'long', year: 'numeric' })],
        ['Assessments this month', thisMonth.length],
        ['Assessments to date', rows.length],
        ['Referral-level this month', thisMonth.filter((r) => r.tier === 'High Risk' || r.tier === 'Critical Risk').length],
        ['Referral-level to date', highRisk.length],
        ['Mean risk score (all)', `${agg?.meanRisk ?? 0}%`],
        ['Distinct patients', new Set(rows.map((r) => r.patient_name).filter(Boolean)).size],
        ['Generated', new Date().toLocaleString()],
      ]
    );
  };

  const REPORTS = [
    {
      icon: FileSpreadsheet,
      title: 'Full Assessment Log',
      desc: 'Every saved assessment with all eight input values, risk score and tier.',
      count: `${rows.length} row${rows.length === 1 ? '' : 's'}`,
      run: exportFullLog,
      enabled: hasData,
    },
    {
      icon: Phone,
      title: 'High-Risk Follow-up List',
      desc: 'Patients at High or Critical risk, with the recommended action for each.',
      count: `${highRisk.length} patient${highRisk.length === 1 ? '' : 's'}`,
      run: exportFollowUp,
      enabled: highRisk.length > 0,
    },
    {
      icon: CalendarClock,
      title: 'Monthly Summary',
      desc: 'Assessment volume and referral rate for the current month and to date.',
      count: `${thisMonth.length} this month`,
      run: exportMonthly,
      enabled: hasData,
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title={t('nav.generateReports')}
        subtitle="Exports generated from your saved assessments"
      />

      {!agg ? (
        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-16">
          <Loader2 size={18} className="animate-spin" /> {t('common.loading')}
        </div>
      ) : !hasData ? (
        <Panel title="Reports" icon={FileSpreadsheet}>
          <EmptyState
            icon={ClipboardList}
            title="Nothing to report yet"
            hint="Reports are generated from saved assessments. Run one and the exports below will be populated with real data."
            action={
              <Link
                href="/"
                className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg font-bold text-xs"
              >
                <BrainCircuit size={15} /> Run an assessment
              </Link>
            }
          />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {REPORTS.map((r) => (
              <div
                key={r.title}
                className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <r.icon size={18} className="text-accent" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    CSV
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900">{r.title}</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-1 flex-1">{r.desc}</p>
                <p className="text-[11px] font-bold text-slate-700 mt-3">{r.count}</p>
                <button
                  onClick={r.run}
                  disabled={!r.enabled}
                  className="mt-3 w-full flex items-center justify-center gap-2 bg-sidebar-bg hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2.5 rounded-xl font-bold text-xs transition-colors"
                >
                  <Download size={14} />
                  {r.enabled ? 'Download' : 'Nothing to export'}
                </button>
              </div>
            ))}
          </div>

          <Panel title="High-Risk Patients" icon={Users}>
            {highRisk.length === 0 ? (
              <EmptyState
                title="No high-risk assessments"
                hint="Patients scoring at High or Critical risk appear here for follow-up."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left min-w-[560px]">
                  <thead className="text-[10px] text-slate-500 uppercase font-bold border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">Patient</th>
                      <th className="px-4 py-3 text-center">Age</th>
                      <th className="px-4 py-3 text-center">Risk</th>
                      <th className="px-4 py-3 text-center">Tier</th>
                      <th className="px-4 py-3 text-right">Assessed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {highRisk.slice(0, 15).map((r) => (
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
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </AppShell>
  );
}
