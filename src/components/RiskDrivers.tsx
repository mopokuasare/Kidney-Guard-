'use client';

import { useEffect, useState } from 'react';
import { Panel } from '@/components/ui';
import {
  explainRisk,
  FEATURE_UNITS,
  type Explanation,
  type FeatureContribution,
  type PatientFeatures,
} from '@/lib/ckdService';
import { useT } from '@/lib/i18n';
import { BarChart3, Loader2, Info } from 'lucide-react';

/**
 * SHAP attribution breakdown for a single prediction.
 *
 * Explanations are optional: the API returns 503 when started with
 * ENABLE_SHAP=0, so this renders nothing rather than surfacing an error.
 */
export const RiskDrivers = ({ features }: { features: PatientFeatures }) => {
  const { t } = useT();
  const [data, setData] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);

    explainRisk(features).then((res) => {
      if (!active) return;
      if (res.success) setData(res.data);
      else setFailed(true);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [features]);

  if (loading) {
    return (
      <Panel title={t('drivers.title')} icon={BarChart3}>
        <div className="flex items-center gap-2 text-slate-400 text-xs py-6 justify-center">
          <Loader2 size={16} className="animate-spin" />
          {t('drivers.loading')}
        </div>
      </Panel>
    );
  }

  // Server has SHAP disabled, or the call failed — stay silent.
  if (failed || !data) return null;

  // Scale bars against the strongest contributor so the chart always fills.
  const max = Math.max(...data.contributions.map((c) => c.abs_contribution_pct), 1);

  return (
    <Panel title={t('drivers.title')} icon={BarChart3}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          {t('drivers.subtitle')}
        </span>
        <div className="flex items-center gap-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-sm bg-[#E74C3C]" />
            {t('drivers.increases')}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="w-2.5 h-2.5 rounded-sm bg-[#27AE60]" />
            {t('drivers.reduces')}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {data.contributions.map((c) => (
          <DriverBar key={c.feature} c={c} max={max} />
        ))}
      </div>

      <div className="flex items-start gap-2 mt-5 pt-4 border-t border-slate-100">
        <Info size={13} className="text-slate-300 shrink-0 mt-0.5" />
        <p className="text-[10px] text-slate-400 leading-relaxed">{t('drivers.note')}</p>
      </div>
    </Panel>
  );
};

const DriverBar = ({ c, max }: { c: FeatureContribution; max: number }) => {
  const { t } = useT();
  const increases = c.shap_value > 0;
  const color = increases ? '#E74C3C' : '#27AE60';
  const width = (c.abs_contribution_pct / max) * 100;
  const unit = FEATURE_UNITS[c.feature] ?? '';
  const isBinary = c.feature === 'diabetes_diagnosed' || c.feature === 'ever_smoked';
  const shown = isBinary ? (c.value === 1 ? 'Yes' : 'No') : `${c.value}${unit ? ` ${unit}` : ''}`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[11px] mb-1">
        <span className="font-medium text-slate-700 truncate">
          {c.label}
          <span className="text-slate-400 font-normal ml-1.5">{shown}</span>
        </span>
        <span className="font-bold tabular-nums shrink-0" style={{ color }}>
          {c.abs_contribution_pct.toFixed(1)}%
        </span>
      </div>
      <div
        className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden"
        role="img"
        aria-label={`${c.label}: ${c.abs_contribution_pct.toFixed(1)}% — ${
          increases ? t('drivers.increases') : t('drivers.reduces')
        }`}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
    </div>
  );
};
