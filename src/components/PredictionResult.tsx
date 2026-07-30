import { Panel } from '@/components/ui';
import { formatResult, type PredictionResponse } from '@/lib/ckdService';
import { Sparkles, Activity, ShieldAlert, TrendingUp, TrendingDown } from 'lucide-react';

export const PredictionResult = ({ response }: { response: PredictionResponse }) => {
  const r = formatResult(response);
  if (!r) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Risk headline */}
      <Panel title="AI Prediction Result" icon={Activity}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Risk score */}
          <div
            className="rounded-2xl p-5 flex flex-col justify-between border"
            style={{ background: r.bgColor, borderColor: r.color + '55' }}
          >
            <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: r.color }}>
              CKD Risk Probability
            </div>
            <div className="text-4xl font-bold my-2" style={{ color: r.color }}>
              {r.riskScore.toFixed(1)}%
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded"
                style={{ background: r.color, color: '#fff' }}
              >
                {r.tier}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {r.urgency}
              </span>
            </div>
          </div>

          {/* eGFR */}
          <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100/50 flex flex-col">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              eGFR
            </div>
            <div className="text-3xl font-bold text-slate-900 leading-tight">
              {r.egfrValue}
              <span className="text-xs font-medium text-slate-400 ml-1">{r.egfrUnit}</span>
            </div>
            <div className="mt-2 text-xs font-bold" style={{ color: r.egfrColor }}>
              {r.egfrStage}
            </div>
            <div className="mt-auto text-[10px] text-slate-400 pt-2">{r.egfrEquation}</div>
          </div>

          {/* Suggested action */}
          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 flex flex-col">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
              Suggested Action
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{r.action}</p>
            <div className="mt-auto text-[10px] font-bold uppercase tracking-wider text-slate-400 pt-2">
              Predicted: {r.predictedClass}
            </div>
          </div>
        </div>
      </Panel>

      {/* Explainability */}
      {r.shapTop5.length > 0 && (
        <Panel title={`Why is risk ${r.riskScore.toFixed(0)}%? · Top Contributing Factors (SHAP)`} icon={Sparkles}>
          <div className="flex flex-col gap-4">
            {r.shapTop5.map((f) => {
              const increases = f.direction?.toLowerCase().includes('increase');
              return (
                <div key={f.feature} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{f.fullName}</span>
                    <span className={`flex items-center gap-1 font-bold ${increases ? 'text-red-500' : 'text-emerald-600'}`}>
                      {increases ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {f.contribution_pct?.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(Math.abs(f.contribution_pct) * 2, 100)}%`,
                        background: increases ? '#ef4444' : '#10b981',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Disclaimer from API */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-3 md:p-4">
        <ShieldAlert size={18} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11px] md:text-xs text-amber-700 leading-relaxed">{r.disclaimer}</p>
      </div>
    </div>
  );
};
