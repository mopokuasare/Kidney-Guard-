'use client';

import { useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { DashboardCard } from '@/components/DashboardCard';
import { InputField } from '@/components/InputField';
import { ToggleButton } from '@/components/ToggleButton';
import { PredictionsTable } from '@/components/PredictionsTable';
import { PredictionResult } from '@/components/PredictionResult';
import { PageHeader, Disclaimer } from '@/components/ui';
import {
  checkApiHealth,
  predictRisk,
  extractFromPdf,
  validatePatientInput,
  savePrediction,
  FEATURE_LABELS,
  type PatientFeatures,
  type RiskAssessment,
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
  Loader2,
  CheckCircle2,
  XCircle,
  Wifi,
  WifiOff,
  FileDown,
  Upload,
} from 'lucide-react';

type FormState = {
  name: string;
  serum_creatinine: string;
  blood_urea_nitrogen: string;
  bp_systolic: string;
  age: string;
  albumin_serum: string;
  bmi: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  serum_creatinine: '',
  blood_urea_nitrogen: '',
  bp_systolic: '',
  age: '',
  albumin_serum: '',
  bmi: '',
};

type FieldErrors = Partial<Record<keyof PatientFeatures, string>>;

export default function PredictRisk() {
  const { t } = useT();
  const { profile } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [diabetes, setDiabetes] = useState(false);
  const [everSmoked, setEverSmoked] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [result, setResult] = useState<RiskAssessment | null>(null);
  // Held in state so the reference stays stable across renders — RiskDrivers
  // keys its SHAP fetch on this object.
  const [submitted, setSubmitted] = useState<PatientFeatures | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);

  // PDF lab-report upload → extract → clinician verifies → predict
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [pdfNotes, setPdfNotes] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkApiHealth().then((h) => setOnline(h.online));
  }, []);

  const set = (key: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const buildFeatures = (): Partial<Record<keyof PatientFeatures, unknown>> => ({
    serum_creatinine: form.serum_creatinine === '' ? undefined : Number(form.serum_creatinine),
    blood_urea_nitrogen: form.blood_urea_nitrogen === '' ? undefined : Number(form.blood_urea_nitrogen),
    bp_systolic: form.bp_systolic === '' ? undefined : Number(form.bp_systolic),
    age: form.age === '' ? undefined : Number(form.age),
    diabetes_diagnosed: diabetes ? 1 : 0,
    albumin_serum: form.albumin_serum === '' ? undefined : Number(form.albumin_serum),
    bmi: form.bmi === '' ? undefined : Number(form.bmi),
    ever_smoked: everSmoked ? 1 : 0,
  });

  const handlePredict = async () => {
    setApiError(null);
    const payload = buildFeatures();
    const { isValid, errors: valErrors } = validatePatientInput(payload);
    setErrors(valErrors);
    if (!isValid) {
      setApiError('Please correct the highlighted fields before running the prediction.');
      return;
    }

    setLoading(true);
    setResult(null);
    setSubmitted(null);
    const features = payload as PatientFeatures;
    const res = await predictRisk(features);
    setLoading(false);

    if (!res.success) {
      setApiError(res.error);
      return;
    }
    setResult(res.data);
    setSubmitted(features);
    await savePrediction(features, res.data, { patientName: form.name });
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const handleReset = () => {
    setForm(EMPTY_FORM);
    setDiabetes(false);
    setEverSmoked(false);
    setErrors({});
    setApiError(null);
    setResult(null);
    setSubmitted(null);
    setPdfStatus(null);
    setPdfNotes([]);
  };

  /**
   * Parse a lab PDF and prefill the form. Deliberately does NOT predict:
   * the clinician must eyeball every parsed value first, because lab layouts
   * vary and a misread number would silently change the risk score.
   */
  const handlePdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdfBusy(true);
    setApiError(null);
    setPdfNotes([]);
    setPdfStatus(t('pdf.extracting'));

    const res = await extractFromPdf(file);
    setPdfBusy(false);
    if (fileRef.current) fileRef.current.value = '';

    if (!res.success) {
      setPdfStatus(null);
      setApiError(res.error);
      return;
    }

    const v = res.data.extracted_values;
    const str = (n?: number) => (n == null ? undefined : String(n));
    setForm((prev) => ({
      ...prev,
      serum_creatinine: str(v.serum_creatinine) ?? prev.serum_creatinine,
      blood_urea_nitrogen: str(v.blood_urea_nitrogen) ?? prev.blood_urea_nitrogen,
      bp_systolic: str(v.bp_systolic) ?? prev.bp_systolic,
      age: str(v.age) ?? prev.age,
      albumin_serum: str(v.albumin_serum) ?? prev.albumin_serum,
      bmi: str(v.bmi) ?? prev.bmi,
    }));
    if (v.diabetes_diagnosed != null) setDiabetes(v.diabetes_diagnosed === 1);
    if (v.ever_smoked != null) setEverSmoked(v.ever_smoked === 1);

    const missing = res.data.missing_fields
      .map((f) => FEATURE_LABELS[f as keyof PatientFeatures] ?? f)
      .join(', ');
    setPdfStatus(
      `${t('pdf.extracted').replace('{n}', String(res.data.fields_extracted))} ` +
        (missing ? `${t('pdf.missing').replace('{fields}', missing)} ` : '') +
        t('pdf.verify')
    );
    setPdfNotes(res.data.notes ?? []);
  };

  return (
    <AppShell>
      <PageHeader
        title={t('predict.title')}
        subtitle={t('predict.subtitle')}
        actions={
          <>
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
            <label className="flex-1 lg:flex-none flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg transition-all font-bold text-xs shadow-lg shadow-accent/20 cursor-pointer">
              {pdfBusy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {t('predict.uploadPdf')}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handlePdf}
                disabled={pdfBusy}
              />
            </label>
          </>
        }
      />

      {/* Verification step — mandatory before trusting extracted values */}
      {pdfStatus && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-3 md:p-4 mb-6">
          <ClipboardList size={18} className="text-accent shrink-0 mt-0.5" />
          <div className="text-[11px] md:text-xs text-slate-700 leading-relaxed">
            <p>{pdfStatus}</p>
            {pdfNotes.length > 0 && (
              <ul className="mt-2 list-disc pl-4 text-amber-700">
                {pdfNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 mb-6">
        <DashboardCard title="Model" value="Ensemble" subtitle="RF+GB+XGBoost→LR" icon={BrainCircuit} />
        <DashboardCard title="Dataset" value="NHANES" subtitle="2021–2023 · 6,326" icon={Activity} />
        <DashboardCard title="Standard" value="KDIGO" subtitle="2024 · CKD-EPI 2021" icon={Target} />
        <DashboardCard title="Features" value="8" subtitle="routine labs" icon={Zap} />
      </div>

      {/* Form Section */}
      <div className="bg-white rounded-xl md:rounded-3xl border border-slate-200 overflow-hidden">
        <div className="bg-sidebar-bg p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-white font-bold">
            <ClipboardList size={16} className="text-slate-400" />
            <span className="text-xs md:text-sm tracking-wide uppercase">Patient Data Entry</span>
          </div>
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
            NHANES · 8 features
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
                <InputField label="Age" placeholder="52" unit="yrs" type="number" value={form.age} onChange={(e) => set('age', e.target.value)} error={errors.age} />
              </div>
            </section>

            {/* Vital Signs */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <Heart size={16} className="text-slate-400" />
                <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('predict.vitals')}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                <InputField label="Systolic Blood Pressure" placeholder="118" unit="mm/Hg" type="number" value={form.bp_systolic} onChange={(e) => set('bp_systolic', e.target.value)} error={errors.bp_systolic} />
                <InputField label="Body Mass Index" placeholder="27.7" unit="kg/m²" type="number" value={form.bmi} onChange={(e) => set('bmi', e.target.value)} error={errors.bmi} />
              </div>
            </section>

            {/* Laboratory Biomarkers */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <FlaskConical size={14} className="text-slate-400" />
                <h2 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{t('predict.labs')}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <InputField label="Serum Creatinine" placeholder="0.83" unit="mg/dl" type="number" value={form.serum_creatinine} onChange={(e) => set('serum_creatinine', e.target.value)} error={errors.serum_creatinine} />
                <InputField label="Blood Urea Nitrogen" placeholder="14.0" unit="mg/dl" type="number" value={form.blood_urea_nitrogen} onChange={(e) => set('blood_urea_nitrogen', e.target.value)} error={errors.blood_urea_nitrogen} />
                <InputField label="Serum Albumin" placeholder="4.1" unit="g/dl" type="number" value={form.albumin_serum} onChange={(e) => set('albumin_serum', e.target.value)} error={errors.albumin_serum} />
              </div>
            </section>

            {/* History */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <Stethoscope size={14} className="text-slate-400" />
                <h2 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{t('predict.comorbidities')}</h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-8">
                <ToggleButton label="Diabetes Diagnosed" value={diabetes} onChange={() => setDiabetes((v) => !v)} />
                <ToggleButton label="Ever Smoked" value={everSmoked} onChange={() => setEverSmoked((v) => !v)} />
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
                  clinician: profile?.full_name ?? undefined,
                })
              }
              className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-lg transition-all font-bold text-xs shadow-lg shadow-accent/20"
            >
              <FileDown size={16} />
              {t('predict.exportPdf')}
            </button>
          </div>
          <PredictionResult response={result} features={submitted ?? undefined} />
        </div>
      ) : (
        <Disclaimer className="mt-6" />
      )}

      {/* Predictions Table */}
      <PredictionsTable />
    </AppShell>
  );
}
