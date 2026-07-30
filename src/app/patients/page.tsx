'use client';

import { useRef, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { InputField } from '@/components/InputField';
import { SelectField } from '@/components/SelectField';
import { ToggleButton } from '@/components/ToggleButton';
import { PageHeader, Panel, SectionLabel, StatusBadge, Disclaimer, StatPill } from '@/components/ui';
import { Sparkline } from '@/components/charts';
import { PredictionResult } from '@/components/PredictionResult';
import {
  extractFromPdf,
  predictCKD,
  FEATURE_LABELS,
  type PatientInput,
  type PredictionResponse,
} from '@/lib/ckdService';
import { Loader2, XCircle } from 'lucide-react';
import {
  Users,
  Search,
  UserPlus,
  ClipboardList,
  Heart,
  FlaskConical,
  Stethoscope,
  History,
  FileText,
  Upload,
  Download,
  StickyNote,
  Sparkles,
  ChevronRight,
} from 'lucide-react';

const patients = [
  { id: '#KG-2026-0845', name: 'Jane Smith', age: 62, gender: 'F', risk: 68, status: 'HIGH', last: 'Jul 30' },
  { id: '#KG-2026-0844', name: 'Robert Chen', age: 55, gender: 'M', risk: 12, status: 'LOW', last: 'Jul 30' },
  { id: '#KG-2026-0843', name: 'Maria Garcia', age: 71, gender: 'F', risk: 85, status: 'VERY HIGH', last: 'Jul 29' },
  { id: '#KG-2026-0842', name: 'David Osei', age: 48, gender: 'M', risk: 44, status: 'MEDIUM', last: 'Jul 28' },
  { id: '#KG-2026-0841', name: 'Amina Bello', age: 66, gender: 'F', risk: 77, status: 'HIGH', last: 'Jul 27' },
];

const history = [42, 51, 48, 57, 61, 64, 68];
const factors = [
  { label: 'Serum Creatinine (2.1 mg/dL)', weight: 34 },
  { label: 'Hemoglobin (10.2 g/dL)', weight: 21 },
  { label: 'Blood Glucose (148 mg/dL)', weight: 13 },
];

export default function PatientRecords() {
  const [selected, setSelected] = useState(patients[0]);
  const [comorbidities, setComorbidities] = useState({
    hypertension: true, diabetes: true, coronary: false, pedalEdema: false, anemia: true,
  });
  const toggle = (k: keyof typeof comorbidities) =>
    setComorbidities((p) => ({ ...p, [k]: !p[k] }));

  // ── Live backend: PDF extraction → verify → predict ──────────────────────
  const fileRef = useRef<HTMLInputElement>(null);
  const [extracted, setExtracted] = useState<Record<string, number> | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const res = await extractFromPdf(file);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
    if (!res.success) {
      setError(res.error);
      return;
    }
    setUploadedName(file.name);
    setExtracted(res.data.extracted_values || {});
    setMissing(res.data.missing_fields || []);
  };

  const handleConfirmPredict = async () => {
    if (!extracted) return;
    setBusy(true);
    setError(null);
    const res = await predictCKD(extracted as unknown as PatientInput);
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    setResult(res.data);
    setExtracted(null);
  };

  return (
    <AppShell>
      <PageHeader
        title="Patient Records"
        subtitle="Full profiles, clinical history and follow-up"
        actions={
          <>
            <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-xs font-medium py-2 px-3 border border-slate-200 rounded-lg bg-white">
              <Download size={16} /> Export PDF
            </button>
            <button className="flex-2 lg:flex-none flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg transition-all font-bold text-xs shadow-lg shadow-accent/20">
              <UserPlus size={16} /> New Patient
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Patient list */}
        <div className="lg:col-span-1">
          <Panel title="Patients" icon={Users}>
            <div className="relative mb-4">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                placeholder="Search name or ID…"
                className="w-full bg-input-bg border border-transparent hover:border-slate-300 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg pl-9 pr-3 py-2.5 text-sm text-slate-900 outline-none transition-all"
              />
            </div>
            <div className="flex flex-col gap-2">
              {patients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className={`flex items-center justify-between gap-2 rounded-xl p-3 text-left transition-all border ${
                    selected.id === p.id ? 'bg-blue-50 border-accent/40' : 'bg-white border-slate-100 hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{p.name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{p.id} · {p.gender} · {p.age}y</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={p.status} />
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        {/* Patient detail */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Demographics + current risk */}
          <Panel
            title={`${selected.name} · ${selected.id}`}
            icon={ClipboardList}
            action={<StatusBadge status={selected.status} />}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatPill label="Age" value={`${selected.age} yrs`} />
              <StatPill label="Gender" value={selected.gender === 'F' ? 'Female' : 'Male'} />
              <StatPill label="Current Risk" value={`${selected.risk}%`} tone={selected.risk >= 70 ? 'red' : selected.risk >= 40 ? 'orange' : 'emerald'} />
              <StatPill label="Last Visit" value={selected.last} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              <InputField label="Contact Number" placeholder="+233 55 000 0000" />
              <InputField label="Email" placeholder="patient@email.com" type="email" />
            </div>
          </Panel>

          {/* Explainability */}
          <Panel title="Why is risk 68%? · Top Contributing Factors" icon={Sparkles}>
            <div className="flex flex-col gap-4">
              {factors.map((f) => (
                <div key={f.label} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{f.label}</span>
                    <span className="font-bold text-slate-900">{f.weight}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${f.weight * 2}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <Disclaimer className="mt-5" />
          </Panel>

          {/* Clinical data entry */}
          <Panel title="Clinical Data Entry" icon={ClipboardList}>
            <section className="mb-6">
              <SectionLabel icon={Heart}>Vitals</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <InputField label="Blood Pressure" placeholder="80" unit="mmHg" />
                <InputField label="Specific Gravity" placeholder="1.02" />
                <SelectField label="Albumin" options={[
                  { label: '0 (Normal)', value: '0' },
                  { label: '1 (Mild)', value: '1' },
                  { label: '2 (Moderate)', value: '2' },
                ]} />
              </div>
            </section>

            <section className="mb-6">
              <SectionLabel icon={FlaskConical}>Laboratory</SectionLabel>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <InputField label="Glucose" placeholder="148" unit="mg/dL" />
                <InputField label="Creatinine" placeholder="1.2" unit="mg/dL" />
                <InputField label="Urea" placeholder="36" unit="mg/dL" />
                <InputField label="Sodium" placeholder="135" unit="mEq/L" />
                <InputField label="Potassium" placeholder="4.5" unit="mEq/L" />
                <InputField label="Hemoglobin" placeholder="12.5" unit="g/dL" />
                <InputField label="PCV" placeholder="38" unit="%" />
                <InputField label="WBC" placeholder="7800" unit="µL" />
                <InputField label="RBC" placeholder="5.2" unit="mil/µL" />
              </div>
              <p className="text-[11px] text-amber-600 mt-3 flex items-center gap-1.5">
                <Stethoscope size={13} /> Values are validated — impossible entries (e.g. BP 500) are flagged before prediction.
              </p>
            </section>

            <section className="mb-6">
              <SectionLabel icon={Stethoscope}>Comorbidities</SectionLabel>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <ToggleButton label="Hypertension" value={comorbidities.hypertension} onChange={() => toggle('hypertension')} />
                <ToggleButton label="Diabetes" value={comorbidities.diabetes} onChange={() => toggle('diabetes')} />
                <ToggleButton label="Coronary" value={comorbidities.coronary} onChange={() => toggle('coronary')} />
                <ToggleButton label="Pedal Edema" value={comorbidities.pedalEdema} onChange={() => toggle('pedalEdema')} />
                <ToggleButton label="Anemia" value={comorbidities.anemia} onChange={() => toggle('anemia')} />
              </div>
            </section>

            <section>
              <SectionLabel icon={Heart}>Lifestyle</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SelectField label="Appetite" options={[{ label: 'Good', value: 'good' }, { label: 'Poor', value: 'poor' }]} />
                <SelectField label="Smoking" options={[{ label: 'Non-smoker', value: 'no' }, { label: 'Smoker', value: 'yes' }]} />
                <SelectField label="Physical Activity" options={[{ label: 'Active', value: 'active' }, { label: 'Sedentary', value: 'sed' }]} />
              </div>
            </section>
          </Panel>

          {/* Prediction history */}
          <Panel title="Prediction History" icon={History}>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-2xl font-bold text-slate-900">{selected.risk}%</span>
              <span className="text-xs font-bold text-red-500">↑ risk trending up</span>
            </div>
            <Sparkline points={history} color="#f97316" />
            <div className="flex justify-between text-[10px] font-medium text-slate-400 uppercase mt-2">
              <span>Jan</span><span>Mar</span><span>May</span><span>Jul</span>
            </div>
          </Panel>

          {/* Notes + files */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Panel title="Doctor's Notes" icon={StickyNote}>
              <textarea
                rows={5}
                placeholder="Recommendations, observations…"
                className="w-full bg-input-bg border border-transparent hover:border-slate-300 focus:border-accent focus:ring-1 focus:ring-accent rounded-lg px-4 py-3 text-sm text-slate-900 outline-none transition-all resize-none"
                defaultValue="Advise nephrology referral. Repeat creatinine in 2 weeks."
              />
              <div className="mt-3">
                <InputField label="Follow-up Date" type="date" defaultValue="2026-08-14" />
              </div>
            </Panel>

            <Panel title="Lab Reports & Files" icon={FileText}>
              <label className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2 hover:border-accent/40 transition-colors cursor-pointer">
                {busy ? <Loader2 size={22} className="text-accent animate-spin" /> : <Upload size={22} className="text-slate-400" />}
                <p className="text-xs text-slate-500">
                  {busy ? 'Reading lab report…' : <>Drop urine test / lab PDFs here or <span className="text-accent font-bold">browse</span></>}
                </p>
                <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleUpload} disabled={busy} />
              </label>
              {uploadedName && (
                <div className="mt-4 flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
                  <span className="flex items-center gap-2 text-xs text-slate-700"><FileText size={14} className="text-slate-400" /> {uploadedName}</span>
                  <Download size={14} className="text-slate-400 hover:text-accent cursor-pointer" />
                </div>
              )}
              {error && (
                <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                  <XCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-700">{error}</p>
                </div>
              )}
            </Panel>
          </div>

          {/* Extracted values — doctor verification before prediction */}
          {extracted && (
            <Panel title="Verify Extracted Values Before Predicting" icon={FileText}>
              <p className="text-xs text-slate-500 mb-4">
                We extracted these values from the lab report. Please confirm they are correct
                {missing.length > 0 && <> — missing: <span className="font-bold text-red-500">{missing.join(', ')}</span></>}.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(extracted).map(([k, v]) => (
                  <div key={k} className="bg-blue-50/50 rounded-lg p-3 border border-blue-100/50">
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{FEATURE_LABELS[k] || k}</div>
                    <div className="text-sm font-bold text-slate-900">{v}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-end mt-5 pt-4 border-t border-slate-100">
                <button onClick={() => setExtracted(null)} className="px-4 py-2.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-900 border border-slate-200 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPredict}
                  disabled={busy || missing.length > 0}
                  className="flex items-center justify-center gap-2 bg-sidebar-bg hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-lg text-xs font-bold transition-colors"
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : null}
                  {missing.length > 0 ? 'Complete missing fields on Predict page' : 'Confirm & Predict'}
                </button>
              </div>
            </Panel>
          )}

          {/* Live prediction result */}
          {result && <PredictionResult response={result} />}

          <button className="self-end flex items-center gap-2 bg-sidebar-bg hover:bg-slate-800 text-white px-6 py-3 rounded-xl transition-all font-bold shadow-xl shadow-slate-900/20">
            <Download size={18} /> Download Patient Summary (PDF)
          </button>
        </div>
      </div>
    </AppShell>
  );
}
