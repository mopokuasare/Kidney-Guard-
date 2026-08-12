'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PageHeader, Panel, StatPill, EmptyState } from '@/components/ui';
import { HBarChart, DonutChart } from '@/components/charts';
import { PatientTrend } from '@/components/PatientTrend';
import { getAggregates, type Aggregates } from '@/lib/ckdService';
import { useT } from '@/lib/i18n';
import {
  BarChart3,
  Users,
  Target,
  Activity,
  Loader2,
  ClipboardList,
  BrainCircuit,
  FlaskConical,
} from 'lucide-react';

/**
 * Model performance figures, measured on the held-out NHANES test set
 * (n = 1,266) at the deployed threshold of 0.1298. These describe the model
 * itself, not this clinic's data, so they are constants rather than queries.
 */
const MODEL_METRICS = [
  { label: 'ROC-AUC', value: '0.838', tone: 'blue' as const },
  { label: 'PR-AUC', value: '0.651', tone: 'blue' as const },
  { label: 'Sensitivity', value: '74.1%', tone: 'emerald' as const },
  { label: 'Specificity', value: '78.8%', tone: 'emerald' as const },
];

export default function Analytics() {
  const { t } = useT();
  const [agg, setAgg] = useState<Aggregates | null>(null);

  useEffect(() => {
    getAggregates().then(setAgg);
  }, []);

  const hasData = Boolean(agg && agg.total > 0);

  return (
    <AppShell>
      <PageHeader
        title={t('nav.analytics')}
        subtitle="Cohort insight from your recorded assessments"
      />

      {/* Per-patient trend (already real) */}
      <PatientTrend />

      {!agg ? (
        <div className="flex items-center justify-center gap-2 text-slate-400 text-sm py-16">
          <Loader2 size={18} className="animate-spin" /> {t('common.loading')}
        </div>
      ) : !hasData ? (
        <Panel title="Cohort Analytics" icon={BarChart3} className="mb-6">
          <EmptyState
            icon={ClipboardList}
            title="No assessments to analyse yet"
            hint="These charts summarise the assessments you record. They stay empty until there is real data — no sample figures are shown."
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatPill label="Assessments" value={String(agg.total)} tone="blue" />
            <StatPill label="Mean Risk" value={`${agg.meanRisk}%`} tone="orange" />
            <StatPill label="Referral-level" value={String(agg.flagged)} tone="red" />
            <StatPill
              label="Referral Rate"
              value={`${Math.round((agg.flagged / agg.total) * 100)}%`}
              tone="orange"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <Panel title="Risk Tier Distribution" icon={Activity}>
              <DonutChart data={agg.byTier} />
            </Panel>
            <Panel title="Assessments by Age Group" icon={Users}>
              {agg.byAge.length ? (
                <HBarChart data={agg.byAge} />
              ) : (
                <EmptyState title="No ages recorded" hint="Age is captured with each assessment." />
              )}
            </Panel>
          </div>

          <Panel title="Typical Values in Your Cohort" icon={FlaskConical} className="mb-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {agg.featureMeans.map((f) => (
                <StatPill
                  key={f.feature}
                  label={f.label}
                  value={
                    f.feature === 'diabetes_diagnosed' || f.feature === 'ever_smoked'
                      ? `${Math.round(f.mean * 100)}%`
                      : String(Math.round(f.mean * 100) / 100)
                  }
                  tone="slate"
                />
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-4 pt-4 border-t border-slate-100">
              Mean of each input across {agg.total} assessment{agg.total === 1 ? '' : 's'}.
              Binary fields are shown as the percentage answering yes.
            </p>
          </Panel>
        </>
      )}

      {/* Model quality — about the model, not this clinic */}
      <Panel title="Model Performance" icon={Target}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {MODEL_METRICS.map((m) => (
            <StatPill key={m.label} label={m.label} value={m.value} tone={m.tone} />
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mt-4 pt-4 border-t border-slate-100 leading-relaxed">
          Measured on a held-out NHANES 2021–2023 test set (n = 1,266) at the deployed
          decision threshold of 0.1298. The threshold is set for screening sensitivity, so
          the model catches roughly three in four true cases at the cost of a higher
          false-alarm rate. Not externally validated on an independent clinical population.
        </p>
      </Panel>
    </AppShell>
  );
}
