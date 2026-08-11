import { getSupabaseBrowser } from '@/lib/supabase/client';

const API_BASE =
  process.env.NEXT_PUBLIC_CKD_API_URL || 'http://localhost:8000';

/* ── Types ─────────────────────────────────────────────────────────────────── */

// The 8 features the NHANES model expects.
export interface PatientFeatures {
  serum_creatinine: number;
  blood_urea_nitrogen: number;
  bp_systolic: number;
  age: number;
  diabetes_diagnosed: 0 | 1;
  albumin_serum: number;
  bmi: number;
  ever_smoked: 0 | 1;
}

export interface RiskAssessment {
  patient_features: Record<string, number>;
  /** Fields the API filled from training medians/modes because they were omitted. */
  imputed_features: string[];
  kd_risk_score: number; // 0–1
  kd_risk_percentage: string; // "74.2%"
  predicted_class: string; // "KD Risk" | "No KD Risk"
  predicted_class_int: number;
  probability_no_kd_risk: number;
  probability_kd_risk: number;
  risk_level: string; // Low / Moderate / High / Critical Risk
  urgency: string; // Routine / Monitor / Refer / Urgent
  action: string;
  threshold_used: number;
  model: string;
  dataset: string;
  standard: string;
  disclaimer: string;
}

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; status?: number };

/* ── Feature metadata ──────────────────────────────────────────────────────── */

export const FEATURE_ORDER: (keyof PatientFeatures)[] = [
  'serum_creatinine',
  'blood_urea_nitrogen',
  'bp_systolic',
  'age',
  'diabetes_diagnosed',
  'albumin_serum',
  'bmi',
  'ever_smoked',
];

export const FEATURE_LABELS: Record<keyof PatientFeatures, string> = {
  serum_creatinine: 'Serum Creatinine',
  blood_urea_nitrogen: 'Blood Urea Nitrogen',
  bp_systolic: 'Systolic Blood Pressure',
  age: 'Age',
  diabetes_diagnosed: 'Diabetes Diagnosed',
  albumin_serum: 'Serum Albumin',
  bmi: 'Body Mass Index',
  ever_smoked: 'Ever Smoked',
};

export const FEATURE_UNITS: Record<keyof PatientFeatures, string> = {
  serum_creatinine: 'mg/dl',
  blood_urea_nitrogen: 'mg/dl',
  bp_systolic: 'mm/Hg',
  age: 'years',
  diabetes_diagnosed: '',
  albumin_serum: 'g/dl',
  bmi: 'kg/m²',
  ever_smoked: '',
};

export const NORMAL_RANGES: Record<keyof PatientFeatures, string> = {
  serum_creatinine: 'Normal: 0.6 – 1.2 mg/dl',
  blood_urea_nitrogen: 'Normal: 7 – 25 mg/dl',
  bp_systolic: 'Normal: < 120 mm/Hg',
  age: 'Patient age in years',
  diabetes_diagnosed: '0 = No · 1 = Yes',
  albumin_serum: 'Normal: 3.5 – 5.0 g/dl',
  bmi: 'Normal: 18.5 – 24.9 kg/m²',
  ever_smoked: '0 = No · 1 = Yes',
};

export const RISK_COLORS: Record<string, string> = {
  'Low Risk': '#27AE60',
  'Moderate Risk': '#F39C12',
  'High Risk': '#E67E22',
  'Critical Risk': '#E74C3C',
};

export const RISK_BG_COLORS: Record<string, string> = {
  'Low Risk': 'rgba(39,174,96,0.15)',
  'Moderate Risk': 'rgba(243,156,18,0.15)',
  'High Risk': 'rgba(230,126,34,0.15)',
  'Critical Risk': 'rgba(231,76,60,0.15)',
};

/* ── Health check ──────────────────────────────────────────────────────────── */

export interface HealthStatus {
  online: boolean;
  message?: string;
  model?: string;
}

export const checkApiHealth = async (): Promise<HealthStatus> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { online: false, message: 'API returned an error.' };
    const data = await res.json();
    return { online: true, message: 'healthy', model: data.model };
  } catch {
    return { online: false, message: 'API server is offline or waking up.' };
  }
};

/* ── Prediction ────────────────────────────────────────────────────────────── */

export const predictRisk = async (
  features: PatientFeatures
): Promise<ServiceResult<RiskAssessment>> => {
  try {
    const res = await fetch(`${API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        success: false,
        error: extractDetail(data) || 'Prediction failed.',
        status: res.status,
      };
    }
    return { success: true, data: data as RiskAssessment };
  } catch {
    return {
      success: false,
      error: 'Cannot connect to prediction server. It may be waking up — try again in a moment.',
    };
  }
};

/* ── Explainability (SHAP) ─────────────────────────────────────────────────── */

export interface FeatureContribution {
  feature: keyof PatientFeatures;
  label: string;
  value: number;
  /** Signed SHAP value: positive pushes toward KD risk. */
  shap_value: number;
  /** Share of total absolute attribution, 0–100. */
  abs_contribution_pct: number;
  direction: 'increases risk' | 'reduces risk';
}

export interface Explanation {
  kd_risk_score: number;
  predicted_class: string;
  base_value: number;
  /** Sorted by abs_contribution_pct, descending. */
  contributions: FeatureContribution[];
  top_drivers: string[];
  method: string;
  disclaimer: string;
}

/**
 * Per-patient SHAP attribution explaining which features drove the score.
 * Returns a failure result (not a throw) when the API instance was started
 * with ENABLE_SHAP=0 — callers should treat explanations as optional.
 */
export const explainRisk = async (
  features: PatientFeatures
): Promise<ServiceResult<Explanation>> => {
  try {
    const res = await fetch(`${API_BASE}/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(features),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return {
        success: false,
        error:
          res.status === 503
            ? 'Explanations are unavailable on this server.'
            : extractDetail(data) || 'Explanation failed.',
        status: res.status,
      };
    }
    return { success: true, data: data as Explanation };
  } catch {
    return {
      success: false,
      error: 'Cannot connect to prediction server.',
    };
  }
};

/** Colour for a SHAP bar: red pushes toward risk, green away from it. */
export const contributionColor = (c: FeatureContribution): string =>
  c.shap_value > 0 ? '#E74C3C' : '#27AE60';

/* ── Input validation ──────────────────────────────────────────────────────── */

const RANGES: Record<keyof PatientFeatures, [number, number]> = {
  serum_creatinine: [0.01, 30],
  blood_urea_nitrogen: [0.01, 200],
  bp_systolic: [61, 260],
  age: [0, 120],
  diabetes_diagnosed: [0, 1],
  albumin_serum: [0.01, 10],
  bmi: [10.01, 100],
  ever_smoked: [0, 1],
};

export const validatePatientInput = (
  data: Partial<Record<keyof PatientFeatures, unknown>>
): { isValid: boolean; errors: Partial<Record<keyof PatientFeatures, string>> } => {
  const errors: Partial<Record<keyof PatientFeatures, string>> = {};

  for (const key of FEATURE_ORDER) {
    const v = data[key];
    if (v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v))) {
      errors[key] = `${FEATURE_LABELS[key]} is required.`;
      continue;
    }
    const n = Number(v);
    const [min, max] = RANGES[key];
    if (Number.isNaN(n) || n < min || n > max) {
      if (key === 'diabetes_diagnosed' || key === 'ever_smoked') {
        errors[key] = 'Must be 0 (No) or 1 (Yes).';
      } else {
        errors[key] = `${FEATURE_LABELS[key]} must be between ${min} and ${max}.`;
      }
    }
  }

  return { isValid: Object.keys(errors).length === 0, errors };
};

/* ── Format result for display ─────────────────────────────────────────────── */

export interface FormattedResult {
  riskScore: number; // percentage 0–100
  riskLabel: string; // "74.2%"
  predictedClass: string;
  tier: string; // risk_level
  urgency: string;
  color: string;
  bgColor: string;
  action: string;
  probKd: number; // percentage
  probNoKd: number; // percentage
  thresholdUsed: number;
  model: string;
  dataset: string;
  standard: string;
  disclaimer: string;
  isCritical: boolean;
  isHighRisk: boolean;
}

export const formatResult = (resp: RiskAssessment | null): FormattedResult | null => {
  if (!resp) return null;
  const tier = resp.risk_level;
  return {
    riskScore: Math.round(resp.kd_risk_score * 1000) / 10,
    riskLabel: resp.kd_risk_percentage,
    predictedClass: resp.predicted_class,
    tier,
    urgency: resp.urgency,
    color: RISK_COLORS[tier] || '#7F8C8D',
    bgColor: RISK_BG_COLORS[tier] || 'rgba(0,0,0,0.1)',
    action: resp.action,
    probKd: Math.round(resp.probability_kd_risk * 1000) / 10,
    probNoKd: Math.round(resp.probability_no_kd_risk * 1000) / 10,
    thresholdUsed: resp.threshold_used,
    model: resp.model,
    dataset: resp.dataset,
    standard: resp.standard,
    disclaimer: resp.disclaimer,
    isCritical: tier === 'Critical Risk',
    isHighRisk: tier === 'High Risk' || tier === 'Critical Risk',
  };
};

/* ── Prediction history (Supabase) ─────────────────────────────────────────── */

export interface PredictionRow {
  id: string;
  patient_name: string | null;
  patient_ref: string | null;
  age: number | null;
  sex: string | null;
  risk_probability: number | null;
  predicted_class: string | null;
  tier: string | null;
  egfr: number | null;
  egfr_stage: string | null;
  inputs: PatientFeatures | null;
  created_at: string;
}

/**
 * Persist a completed prediction. No-ops silently when Supabase isn't
 * configured or no user is signed in, so the prediction flow never breaks.
 */
export const savePrediction = async (
  input: PatientFeatures,
  result: RiskAssessment,
  meta?: { patientName?: string; patientRef?: string }
): Promise<void> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;

  await supabase.from('predictions').insert({
    user_id: uid,
    patient_name: meta?.patientName?.trim() || null,
    patient_ref: meta?.patientRef?.trim() || null,
    age: input.age,
    sex: null,
    risk_probability: Math.round(result.kd_risk_score * 1000) / 10,
    predicted_class: result.predicted_class,
    tier: result.risk_level,
    egfr: null,
    egfr_stage: null,
    inputs: input,
  });
};

export const getRecentPredictions = async (limit = 10): Promise<PredictionRow[]> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return [];
  const { data } = await supabase
    .from('predictions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as PredictionRow[]) ?? [];
};

/** All predictions for one patient (by name), oldest→newest for trend charts. */
export const getPatientHistory = async (name: string): Promise<PredictionRow[]> => {
  const supabase = getSupabaseBrowser();
  if (!supabase || !name) return [];
  const { data } = await supabase
    .from('predictions')
    .select('*')
    .ilike('patient_name', name)
    .order('created_at', { ascending: true });
  return (data as PredictionRow[]) ?? [];
};

/** Distinct patient names that have at least one saved prediction. */
export const getDistinctPatients = async (): Promise<string[]> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return [];
  const { data } = await supabase
    .from('predictions')
    .select('patient_name, created_at')
    .not('patient_name', 'is', null)
    .order('created_at', { ascending: false })
    .limit(500);
  const names = (data ?? [])
    .map((r: { patient_name: string | null }) => r.patient_name)
    .filter((n): n is string => Boolean(n));
  return Array.from(new Set(names));
};

/* ── helpers ───────────────────────────────────────────────────────────────── */

function extractDetail(data: unknown): string | null {
  if (data && typeof data === 'object' && 'detail' in data) {
    const d = (data as { detail: unknown }).detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d) && d[0] && typeof d[0] === 'object' && 'msg' in d[0]) {
      return String((d[0] as { msg: unknown }).msg);
    }
  }
  return null;
}
