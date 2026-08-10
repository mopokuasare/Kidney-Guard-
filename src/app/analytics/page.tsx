'use client';

import { AppShell } from '@/components/AppShell';
import { SelectField } from '@/components/SelectField';
import { PageHeader, Panel, StatPill } from '@/components/ui';
import { HBarChart, DonutChart, Sparkline } from '@/components/charts';
import { PatientTrend } from '@/components/PatientTrend';
import {
  BarChart3,
  Users,
  FlaskConical,
  Target,
  Activity,
  Filter,
} from 'lucide-react';

const riskDrivers = [
  { label: 'Serum Creatinine', value: 34, color: '#ef4444' },
  { label: 'Hemoglobin', value: 26, color: '#f97316' },
  { label: 'Blood Glucose', value: 18, color: '#f59e0b' },
  { label: 'Albumin', value: 12, color: '#3b82f6' },
  { label: 'Blood Pressure', value: 10, color: '#10b981' },
];

const byAge = [
  { label: '18–39', value: 42, color: '#10b981' },
  { label: '40–59', value: 156, color: '#f59e0b' },
  { label: '60–74', value: 214, color: '#f97316' },
  { label: '75+', value: 98, color: '#ef4444' },
];

const byGender = [
  { label: 'Male', value: 289, color: '#3b82f6' },
  { label: 'Female', value: 221, color: '#ec4899' },
];

const creatinineTrend = [1.3, 1.4, 1.35, 1.5, 1.6, 1.58, 1.7];
const egfrTrend = [78, 74, 75, 70, 66, 67, 62];

/* Confusion matrix: [[TN, FP], [FN, TP]] */
const cm = { tn: 812, fp: 24, fn: 18, tp: 393 };

export default function Analytics() {
  return (
    <AppShell>
      <PageHeader
        title="Analytics"
        subtitle="Clinical insight & model quality assurance"
      />

      {/* Real per-patient risk trend (Supabase-backed) */}
      <PatientTrend />

      {/* Filters */}
      <Panel title="Filters" icon={Filter} className="mb-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SelectField label="Date Range" options={[
            { label: 'Last 30 days', value: '30' },
            { label: 'Last 90 days', value: '90' },
            { label: 'This year', value: 'year' },
          ]} />
          <SelectField label="Clinic" options={[
            { label: 'All Clinics', value: 'all' },
            { label: 'Main Campus', value: 'main' },
            { label: 'North Branch', value: 'north' },
          ]} />
          <SelectField label="Doctor" options={[
            { label: 'All Doctors', value: 'all' },
            { label: 'Dr. Mensah', value: 'mensah' },
            { label: 'Dr. Owusu', value: 'owusu' },
          ]} />
          <SelectField label="Risk Level" options={[
            { label: 'All Levels', value: 'all' },
            { label: 'High + Very High', value: 'high' },
            { label: 'Low', value: 'low' },
          ]} />
        </div>
      </Panel>

      {/* Risk factor analysis + comorbidity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Panel title="Risk Factor Analysis · Feature Importance" icon={BarChart3}>
          <HBarChart data={riskDrivers} />
          <p className="text-[11px] text-slate-500 mt-4 pt-4 border-t border-slate-100">
            Creatinine + Hemoglobin together drive <span className="font-bold text-slate-700">60%</span> of high-risk cases.
          </p>
        </Panel>

        <Panel title="Comorbidity Correlation" icon={Activity}>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <StatPill label="DM + HTN in High Risk" value="71%" tone="red" />
            <StatPill label="Anemia in High Risk" value="58%" tone="orange" />
            <StatPill label="CAD in High Risk" value="34%" tone="orange" />
            <StatPill label="Pedal Edema" value="41%" tone="orange" />
          </div>
          <HBarChart data={[
            { label: 'Diabetes + Hypertension', value: 71, color: '#ef4444' },
            { label: 'Anemia', value: 58, color: '#f97316' },
            { label: 'Pedal Edema', value: 41, color: '#f59e0b' },
            { label: 'Coronary Artery Disease', value: 34, color: '#3b82f6' },
          ]} />
        </Panel>
      </div>

      {/* Demographic breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Panel title="Risk by Age Group" icon={Users}>
          <HBarChart data={byAge} />
        </Panel>
        <Panel title="Risk by Gender" icon={Users}>
          <DonutChart data={byGender} />
        </Panel>
      </div>

      {/* Lab trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Panel title="Avg Serum Creatinine Trend" icon={FlaskConical}>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-2xl font-bold text-slate-900">1.70 mg/dL</span>
            <span className="text-xs font-bold text-red-500">↑ rising</span>
          </div>
          <Sparkline points={creatinineTrend} color="#ef4444" />
        </Panel>
        <Panel title="Avg eGFR Trend" icon={FlaskConical}>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-2xl font-bold text-slate-900">62 mL/min</span>
            <span className="text-xs font-bold text-orange-500">↓ declining</span>
          </div>
          <Sparkline points={egfrTrend} color="#f97316" />
        </Panel>
      </div>

      {/* Model performance */}
      <Panel title="Model Performance" icon={Target}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Confusion Matrix</h3>
            <div className="grid grid-cols-2 gap-2 max-w-sm">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600">{cm.tn}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">True Negative</div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-red-500">{cm.fp}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">False Positive</div>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-red-500">{cm.fn}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">False Negative</div>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-emerald-600">{cm.tp}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">True Positive</div>
              </div>
            </div>
          </div>
          <div>
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Metrics & Drift</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatPill label="Accuracy" value="97.4%" tone="emerald" />
              <StatPill label="AUC-ROC" value="0.987" tone="blue" />
              <StatPill label="Precision" value="94.2%" tone="emerald" />
              <StatPill label="Recall" value="95.6%" tone="emerald" />
            </div>
            <div className="mt-4 flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <span className="text-sm font-medium text-slate-700">Data Drift Detection</span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded uppercase">Stable</span>
            </div>
          </div>
        </div>
      </Panel>
    </AppShell>
  );
}
