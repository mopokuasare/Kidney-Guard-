'use client';

import { Panel } from '@/components/ui';
import { RiskDrivers } from '@/components/RiskDrivers';
import {
  formatResult,
  FEATURE_LABELS,
  type PatientFeatures,
  type RiskAssessment,
} from '@/lib/ckdService';
import { useT } from '@/lib/i18n';
import { Activity, ShieldAlert, Gauge, Info } from 'lucide-react';

export const PredictionResult = ({
  response,
  features,
}: {
  response: RiskAssessment;
  /** Original input — enables the SHAP driver breakdown when provided. */
  features?: PatientFeatures;
}) => {
  const { t } = useT();
  const r = formatResult(response);
  if (!r) return null;

  // Risk level and urgency are the clinical headline. `predicted_class` flips at
  // the F1-optimal threshold (0.4439), not at a band edge, so it can read as
  // "KD Risk" while the band says "Moderate" — shown as a footnote, not a verdict.
  const level = t(`risk.${r.tier}`);
  const urgency = t(`urgency.${response.urgency}`);
  const action = t(`action.${r.tier}`) || r.action;
  const imputed = response.imputed_features ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Panel title={t('result.title')} icon={Activity}>
        {/* ── Clinical headline ─────────────────────────────────── */}
        <div
          className="rounded-2xl border p-5 md:p-6"
          style={{ background: r.bgColor, borderColor: r.color + '55' }}
        >
          <div className="flex flex-col md:flex-row md:items-center gap-5">
            {/* Risk level + urgency */}
            <div className="flex-1 min-w-0">
              <div
                className="text-[10px] font-bold uppercase tracking-wider mb-1"
                style={{ color: r.color }}
              >
                {t('result.riskScore')}
              </div>
              <div
                className="text-3xl md:text-4xl font-bold leading-tight"
                style={{ color: r.color }}
              >
                {level}
              </div>
              <div
                className="inline-flex items-center mt-2 text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded"
                style={{ background: r.color, color: '#fff' }}
              >
                {urgency}
              </div>
            </div>

            {/* Score dial */}
            <div className="flex items-center gap-4 md:border-l md:pl-6" style={{ borderColor: r.color + '33' }}>
              <RiskDial value={r.riskScore} color={r.color} />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {t('result.kdRisk')}
                </div>
                <div className="text-2xl font-bold" style={{ color: r.color }}>
                  {r.riskLabel}
                </div>
              </div>
            </div>
          </div>

          {/* Recommended action */}
          <div className="mt-5 pt-5 border-t" style={{ borderColor: r.color + '33' }}>
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              {t('result.action')}
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{action}</p>
          </div>
        </div>

        {/* ── Estimated-input notice ────────────────────────────── */}
        {imputed.length > 0 && (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3 mt-4">
            <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
            <div className="text-[11px] text-blue-800 leading-relaxed">
              <span className="font-bold">{t('result.estimated')}.</span>{' '}
              {t('result.estimatedHint')}{' '}
              <span className="font-medium">
                {imputed
                  .map((f) => FEATURE_LABELS[f as keyof PatientFeatures] ?? f)
                  .join(', ')}
              </span>
            </div>
          </div>
        )}

        {/* ── Secondary detail ──────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-3">
              {t('result.probability')}
            </div>
            <ProbBar label={t('result.kdRisk')} value={r.probKd} color={r.color} />
            <ProbBar label={t('result.noKdRisk')} value={r.probNoKd} color="#94a3b8" />
          </div>

          {/* predicted_class demoted: labelled a screening flag, with the
              threshold that produced it, so it can't be read as the verdict. */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              {t('result.screening')}
            </div>
            <div className="text-sm font-bold text-slate-700">
              {r.predictedClass === 'KD Risk' ? t('result.kdRisk') : t('result.noKdRisk')}
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1.5">
              <Gauge size={12} />
              {t('result.threshold')}: {(r.thresholdUsed * 100).toFixed(1)}%
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed mt-auto pt-3">
              {t('result.screeningHint')}
            </p>
          </div>
        </div>

        {/* Model provenance */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-100">
          <Meta label="Model" value={r.model} />
          <Meta label="Dataset" value={r.dataset} />
          <Meta label="Standard" value={r.standard} />
        </div>
      </Panel>

      {/* ── SHAP drivers ──────────────────────────────────────── */}
      {features && <RiskDrivers features={features} />}

      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 md:p-4">
        <ShieldAlert size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11px] md:text-xs text-amber-700 leading-relaxed">{r.disclaimer}</p>
      </div>
    </div>
  );
};

/* Circular score dial. */
const RiskDial = ({ value, color }: { value: number; color: string }) => {
  const size = 72;
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, value));

  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90" aria-hidden="true">
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="#e2e8f0" strokeWidth={stroke}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference - (pct / 100) * circumference}
      />
    </svg>
  );
};

const ProbBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="mb-2">
    <div className="flex items-center justify-between text-[11px] mb-1">
      <span className="font-medium text-slate-600">{label}</span>
      <span className="font-bold text-slate-900">{value.toFixed(1)}%</span>
    </div>
    <div className="h-2 w-full bg-slate-200/70 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, background: color }} />
    </div>
  </div>
);

const Meta = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</div>
    <div className="text-[11px] text-slate-600 leading-tight mt-0.5">{value}</div>
  </div>
);
