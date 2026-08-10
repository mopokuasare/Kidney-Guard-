'use client';

import { useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { DashboardCard } from '@/components/DashboardCard';
import { InputField } from '@/components/InputField';
import { SelectField } from '@/components/SelectField';
import { ToggleButton } from '@/components/ToggleButton';
import { PredictionsTable } from '@/components/PredictionsTable';
import { PredictionResult } from '@/components/PredictionResult';
import { PageHeader, Disclaimer } from '@/components/ui';
import {
  checkApiHealth,
  predictCKD,
  extractFromPdf,
  validatePatientInput,
  savePrediction,
  type PatientInput,
  type PredictionResponse,
} from '@/lib/ckdService';
import { generateSummaryPdf } from '@/lib/pdf';
import { useT } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import {
  RefreshCw,
  Activity,
  AlertTriangle,
  Target,
  Zap,
  ClipboardList,
  Trash2,
  BrainCircuit,
  Stethoscope,
  FlaskConical,
  Heart,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  FileDown,
} from 'lucide-react';

type FormState = {
  name: string;
  age: string;
  sex: 'male' | 'female';
  bp: string;
  sg: string;
  al: string;
  bgr: string;
  bu: string;
  sc: string;
  sod: string;
  pot: string;
  hemo: string;
  pcv: string;
  wbcc: string;
  rbcc: string;
  appetite: string;
};

const EMPTY_FORM: FormState = {
  name: '', age: '', sex: 'male', bp: '', sg: '', al: '0', bgr: '', bu: '', sc: '',
  sod: '', pot: '', hemo: '', pcv: '', wbcc: '', rbcc: '', appetite: 'good',
};

type FieldErrors = Partial<Record<keyof PatientInput, string>>;

export default function PredictRisk() {
  const { t } = useT();
  const { profile } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [comorbidities, setComorbidities] = useState({
    hypertension: false, diabetes: false, coronary: false, pedalEdema: false, anemia: false,
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);

  // PDF two-step verification flow
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkApiHealth().then((h) => setOnline(h.online));
  }, []);

  const set = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const toggleComorbidity = (key: keyof typeof comorbidities) =>
    setComorbidities((prev) => ({ ...prev, [key]: !prev[key] }));

  const buildPayload = (): Partial<Record<keyof PatientInput, unknown>> => ({
    age: form.age === '' ? undefined : Number(form.age),
    sex: form.sex,
    hemo: form.hemo === '' ? undefined : Number(form.hemo),
    sc: form.sc === '' ? undefined : Number(form.sc),
    bu: form.bu === '' ? undefined : Number(form.bu),
    sod: form.sod === '' ? undefined : Number(form.sod),
    bgr: form.bgr === '' ? undefined : Number(form.bgr),
    wbcc: form.wbcc === '' ? undefined : Number(form.wbcc),
    sg: form.sg === '' ? undefined : Number(form.sg),
    al: form.al === '' ? undefined : Number(form.al),
    pcv: form.pcv === '' ? undefined : Number(form.pcv),
    rbcc: form.rbcc === '' ? undefined : Number(form.rbcc),
    htn: comorbidities.hypertension ? 1 : 0,
    dm: comorbidities.diabetes ? 1 : 0,
  });

  const handlePredict = async () => {
    setApiError(null);
    const payload = buildPayload();
    const { isValid, errors: valErrors } = validatePatientInput(payload);
    setErrors(valErrors);
    if (!isValid) {
      setApiError('Please correct the highlighted fields before running the prediction.');
      return;
    }

    setLoading(true);
    setResult(null);
    const res = await predictCKD(payload as PatientInput);
    setLoading(false);

    if (!res.success) {
      setApiError(res.error);
      return;
    }
    setResult(res.data);
    // Persist to Supabase (no-op if unconfigured / signed out)
    await savePrediction(payload as PatientInput, res.data, { patientName: form.name });
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleReset = () => {
    setForm(EMPTY_FORM);
    setComorbidities({ hypertension: false, diabetes: false, coronary: false, pedalEdema: false, anemia: false });
    setErrors({});
    setApiError(null);
    setResult(null);
    setPdfStatus(null);
  };

  // PDF upload → extract → prefill form for doctor verification
  const handlePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfBusy(true);
    setApiError(null);
    setPdfStatus('Extracting values from lab report…');

    const res = await extractFromPdf(file);
    setPdfBusy(false);
    if (fileRef.current) fileRef.current.value = '';

    if (!res.success) {
      setPdfStatus(null);
      setApiError(res.error);
      return;
    }

    const v = res.data.extracted_values || {};
    setForm((prev) => ({
      ...prev,
      age: v.age != null ? String(v.age) : prev.age,
      hemo: v.hemo != null ? String(v.hemo) : prev.hemo,
      sc: v.sc != null ? String(v.sc) : prev.sc,
      bu: v.bu != null ? String(v.bu) : prev.bu,
      sod: v.sod != null ? String(v.sod) : prev.sod,
      bgr: v.bgr != null ? String(v.bgr) : prev.bgr,
      wbcc: v.wbcc != null ? String(v.wbcc) : prev.wbcc,
      sg: v.sg != null ? String(v.sg) : prev.sg,
      al: v.al != null ? String(v.al) : prev.al,
      pcv: v.pcv != null ? String(v.pcv) : prev.pcv,
      rbcc: v.rbcc != null ? String(v.rbcc) : prev.rbcc,
    }));
    if (v.htn != null || v.dm != null) {
      setComorbidities((prev) => ({
        ...prev,
        hypertension: v.htn != null ? Boolean(v.htn) : prev.hypertension,
        diabetes: v.dm != null ? Boolean(v.dm) : prev.diabetes,
      }));
    }

    const missing = res.data.missing_fields || [];
    setPdfStatus(
      missing.length
        ? `Extracted ${Object.keys(v).length} value(s). Please review and enter the missing field(s): ${missing.join(', ')}. Confirm the values below, then Run AI Prediction.`
        : `Extracted ${Object.keys(v).length} value(s). Please verify the values below are correct, then Run AI Prediction.`
    );
  };

  return (
    <AppShell>
      <PageHeader
        title={t('predict.title')}
        subtitle={t('predict.subtitle')}
        actions={
          <>
            {/* API health pill */}
            <span
              className={`hidden lg:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-2 rounded-lg ${
                online == null
                  ? 'bg-slate-100 text-slate-400'
                  : online
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {online == null ? <Loader2 size={13} className="animate-spin" /> : online ? <Wifi size={13} /> : <WifiOff size={13} />}
              {online == null ? t('status.checking') : online ? t('status.online') : t('status.offline')}
            </span>
            <button
              onClick={handleReset}
              className="flex-1 lg:flex-none flex items-center justify-center gap-2 text-slate-500 hover:text-slate-900 transition-colors text-xs font-medium py-2"
            >
              <RefreshCw size={16} />
              {t('predict.reset')}
            </button>
            <label className="flex-2 lg:flex-none flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg transition-all font-bold text-xs shadow-lg shadow-accent/20 cursor-pointer">
              {pdfBusy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {t('predict.uploadPdf')}
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handlePdf} disabled={pdfBusy} />
            </label>
          </>
        }
      />

      {/* PDF verification banner (docs-mandated doctor verification step) */}
      {pdfStatus && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3 md:p-4 mb-6">
          <ClipboardList size={18} className="text-accent shrink-0 mt-0.5" />
          <p className="text-[11px] md:text-xs text-slate-700 leading-relaxed">{pdfStatus}</p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6">
        <DashboardCard title="Total" value="1,247" subtitle="↑ 12.4% this mo" icon={Activity} />
        <DashboardCard title="High Risk" value="342" subtitle="↑ 8.1% vs last" icon={AlertTriangle} />
        <DashboardCard title="Accuracy" value="97.4%" subtitle="AUC: 0.987" icon={Target} />
        <DashboardCard title="Avg Time" value="0.3s" subtitle="↓ 15% faster" icon={Zap} />
      </div>

      {/* Form Section */}
      <div className="bg-white rounded-xl md:rounded-3xl border border-slate-200 overflow-hidden">
        <div className="bg-sidebar-bg p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-white font-bold">
            <ClipboardList size={16} className="text-slate-400" />
            <span className="text-xs md:text-sm tracking-wide uppercase">Patient Data Entry</span>
          </div>
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            ID: <span className="text-slate-300">#KG-2026-0847</span>
          </div>
        </div>

        <div className="p-4 md:p-8">
          <form className="space-y-6 md:space-y-10" onSubmit={(e) => { e.preventDefault(); handlePredict(); }}>
            {/* Demographics */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <ClipboardList size={14} className="text-slate-400" />
                <h2 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{t('predict.demographics')}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <InputField label="Patient Name" placeholder="John Doe" value={form.name} onChange={(e) => set('name', e.target.value)} />
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Age" placeholder="45" unit="yrs" type="number" value={form.age} onChange={(e) => set('age', e.target.value)} error={errors.age} />
                  <SelectField
                    label="Gender"
                    value={form.sex}
                    onChange={(e) => set('sex', e.target.value)}
                    options={[
                      { label: 'Male', value: 'male' },
                      { label: 'Female', value: 'female' },
                    ]}
                  />
                </div>
              </div>
            </section>

            {/* Vital Signs */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <Heart size={16} className="text-slate-400" />
                <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('predict.vitals')}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <InputField label="Blood Pressure" placeholder="80" unit="mmHg" type="number" value={form.bp} onChange={(e) => set('bp', e.target.value)} />
                <InputField label="Specific Gravity" placeholder="1.02" type="number" value={form.sg} onChange={(e) => set('sg', e.target.value)} error={errors.sg} />
                <SelectField
                  label="Albumin Level"
                  value={form.al}
                  onChange={(e) => set('al', e.target.value)}
                  options={[
                    { label: '0 (Normal)', value: '0' },
                    { label: '1 (Mild)', value: '1' },
                    { label: '2 (Moderate)', value: '2' },
                    { label: '3 (High)', value: '3' },
                    { label: '4 (Severe)', value: '4' },
                    { label: '5 (Very Severe)', value: '5' },
                  ]}
                />
              </div>
            </section>

            {/* Laboratory Biomarkers */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <FlaskConical size={14} className="text-slate-400" />
                <h2 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{t('predict.labs')}</h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-2 gap-x-3 md:gap-x-12 gap-y-4 md:gap-y-6">
                <InputField label="Blood Glucose" placeholder="148" unit="mg/dL" type="number" value={form.bgr} onChange={(e) => set('bgr', e.target.value)} error={errors.bgr} />
                <InputField label="Blood Urea" placeholder="36" unit="mg/dL" type="number" value={form.bu} onChange={(e) => set('bu', e.target.value)} error={errors.bu} />
                <InputField label="Creatinine" placeholder="1.2" unit="mg/dL" type="number" value={form.sc} onChange={(e) => set('sc', e.target.value)} error={errors.sc} />
                <InputField label="Sodium" placeholder="135" unit="mEq/L" type="number" value={form.sod} onChange={(e) => set('sod', e.target.value)} error={errors.sod} />
                <InputField label="Potassium" placeholder="4.5" unit="mEq/L" type="number" value={form.pot} onChange={(e) => set('pot', e.target.value)} />
                <InputField label="Hemoglobin" placeholder="12.5" unit="g/dL" type="number" value={form.hemo} onChange={(e) => set('hemo', e.target.value)} error={errors.hemo} />
                <InputField label="Packed Vol" placeholder="38" unit="%" type="number" value={form.pcv} onChange={(e) => set('pcv', e.target.value)} error={errors.pcv} />
                <InputField label="WBC Count" placeholder="7800" unit="µL" type="number" value={form.wbcc} onChange={(e) => set('wbcc', e.target.value)} error={errors.wbcc} />
                <InputField label="RBC Count" placeholder="5.2" unit="mil/µL" type="number" value={form.rbcc} onChange={(e) => set('rbcc', e.target.value)} error={errors.rbcc} />
              </div>
            </section>

            {/* Comorbidities */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Stethoscope size={14} className="text-slate-400" />
                <h2 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{t('predict.comorbidities')}</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8">
                <ToggleButton label="Hypertension" value={comorbidities.hypertension} onChange={() => toggleComorbidity('hypertension')} />
                <ToggleButton label="Diabetes" value={comorbidities.diabetes} onChange={() => toggleComorbidity('diabetes')} />
                <ToggleButton label="Coronary" value={comorbidities.coronary} onChange={() => toggleComorbidity('coronary')} />
                <ToggleButton label="Edema" value={comorbidities.pedalEdema} onChange={() => toggleComorbidity('pedalEdema')} />
                <ToggleButton label="Anemia" value={comorbidities.anemia} onChange={() => toggleComorbidity('anemia')} />
                <SelectField
                  label="Appetite"
                  value={form.appetite}
                  onChange={(e) => set('appetite', e.target.value)}
                  options={[
                    { label: 'Good', value: 'good' },
                    { label: 'Poor', value: 'poor' },
                  ]}
                />
              </div>
            </section>

            {apiError && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-3 md:p-4">
                <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700 leading-relaxed">{apiError}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto flex items-center justify-center gap-2 text-slate-400 hover:text-red-500 transition-colors text-sm font-medium py-2"
              >
                <Trash2 size={18} />
                {t('predict.clear')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto flex items-center justify-center gap-3 bg-sidebar-bg hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed text-white px-8 py-3.5 rounded-xl transition-all font-bold shadow-xl shadow-slate-900/20"
              >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <BrainCircuit size={20} />}
                {loading ? t('predict.analyzing') : t('predict.run')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Result or fallback disclaimer */}
      {result ? (
        <div ref={resultRef} className="mt-6 scroll-mt-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
              <CheckCircle2 size={18} /> {t('predict.complete')}
            </div>
            <button
              onClick={() =>
                generateSummaryPdf(result, {
                  patientName: form.name,
                  age: form.age,
                  sex: form.sex,
                  clinician: profile?.full_name ?? undefined,
                  inputs: buildPayload() as Record<string, number | string | undefined>,
                })
              }
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg transition-all font-bold text-xs shadow-lg shadow-accent/20"
            >
              <FileDown size={16} />
              {t('predict.exportPdf')}
            </button>
          </div>
          <PredictionResult response={result} />
        </div>
      ) : (
        <Disclaimer className="mt-6" />
      )}

      {/* Predictions Table */}
      <PredictionsTable />
    </AppShell>
  );
}
