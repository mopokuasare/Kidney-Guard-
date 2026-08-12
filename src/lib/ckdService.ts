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

export interface LimeContribution {
  feature: keyof PatientFeatures;
  label: string;
  value: number;
  /** Human-readable local rule, e.g. "serum_creatinine > 0.98". */
  condition: string;
  lime_weight: number;
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
  /** Empty when LIME is disabled on the server — render SHAP alone. */
  lime_contributions?: LimeContribution[];
  lime_method?: string | null;
  lime_available?: boolean;
  /** Features both methods rank in their top 3. */
  agreement?: string[];
}

/* ── PDF lab-report extraction ─────────────────────────────────────────────── */

export interface ExtractionResult {
  filename: string;
  extracted_values: Partial<Record<keyof PatientFeatures, number>>;
  display_values: Record<string, number>;
  missing_fields: string[];
  extraction_confidence: number;
  fields_extracted: number;
  fields_expected: number;
  /** Values rejected as implausible, explained for the clinician. */
  notes: string[];
  instructions: string;
}

/**
 * Parse a lab-report PDF into the 8 model inputs. Extract-only by design: the
 * clinician verifies and corrects the values before any prediction is run.
 */
export const extractFromPdf = async (
  file: File
): Promise<ServiceResult<ExtractionResult>> => {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return { success: false, error: 'Only PDF files are accepted.' };
  }
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(`${API_BASE}/extract`, { method: 'POST', body: formData });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const msg =
        res.status === 422
          ? 'This PDF appears to be a scan or image, so no text could be read. Please enter the values manually.'
          : res.status === 503
          ? 'PDF processing is not available on this server.'
          : extractDetail(data) || 'Could not read the PDF.';
      return { success: false, error: msg, status: res.status };
    }
    return { success: true, data: data as ExtractionResult };
  } catch {
    return { success: false, error: 'Cannot connect to the prediction server.' };
  }
};

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
  meta?: { patientName?: string; patientRef?: string; patientId?: string }
): Promise<void> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return;

  /**
   * Attach the assessment to a real patient record. If the clinician picked an
   * existing patient we use that id; otherwise a name typed free-hand is
   * matched case-insensitively to an existing patient, and only creates a new
   * record when there is genuinely no match — so "john doe" and "John Doe"
   * remain one person rather than two.
   */
  let patientId = meta?.patientId ?? null;
  const typedName = meta?.patientName?.trim();

  if (!patientId && typedName) {
    const { data: found } = await supabase
      .from('patients')
      .select('id')
      .ilike('full_name', typedName)
      .limit(1);

    if (found?.length) {
      patientId = (found[0] as { id: string }).id;
    } else {
      const created = await createPatient({ full_name: typedName });
      if (created.success) patientId = created.data.id;
    }
  }

  await supabase.from('predictions').insert({
    user_id: uid,
    patient_id: patientId,
    patient_name: typedName || null,
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

export interface ClinicalStats {
  /** Assessments recorded since midnight today. */
  today: number;
  /** Assessments in the shared log flagged High or Critical Risk. */
  needsReferral: number;
  /** Distinct named patients assessed. */
  patients: number;
  /** Most recent assessment timestamp, ISO string. */
  lastAt: string | null;
}

/**
 * Caseload figures for the clinician's summary cards. Returns zeros when
 * Supabase isn't configured or nothing has been recorded yet — the cards then
 * read as an empty caseload rather than showing invented numbers.
 */
export const getClinicalStats = async (): Promise<ClinicalStats> => {
  const empty: ClinicalStats = { today: 0, needsReferral: 0, patients: 0, lastAt: null };
  const supabase = getSupabaseBrowser();
  if (!supabase) return empty;

  const { data } = await supabase
    .from('predictions')
    .select('patient_name, tier, created_at')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (!data?.length) return empty;

  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const rows = data as { patient_name: string | null; tier: string | null; created_at: string }[];
  return {
    today: rows.filter((r) => new Date(r.created_at) >= midnight).length,
    needsReferral: rows.filter((r) => r.tier === 'High Risk' || r.tier === 'Critical Risk').length,
    patients: new Set(rows.map((r) => r.patient_name).filter(Boolean)).size,
    lastAt: rows[0]?.created_at ?? null,
  };
};

/* ── Patient records ───────────────────────────────────────────────────────── */

export interface Patient {
  id: string;
  mrn: string | null;
  full_name: string;
  date_of_birth: string | null;
  sex: 'male' | 'female' | 'other' | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
}

export interface PatientSummary extends Omit<Patient, 'notes' | 'created_at'> {
  assessment_count: number;
  last_assessed: string | null;
  latest_risk: number | null;
  latest_tier: string | null;
}

/** Whole-years age from a date of birth, or null if unknown. */
export const ageFromDob = (dob: string | null): number | null => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 130 ? age : null;
};

/** Patient list with assessment counts and latest risk, from patient_summary. */
export const getPatients = async (): Promise<PatientSummary[]> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return [];
  const { data } = await supabase
    .from('patient_summary')
    .select('*')
    .order('last_assessed', { ascending: false, nullsFirst: false });
  return (data as PatientSummary[]) ?? [];
};

export const getPatient = async (id: string): Promise<Patient | null> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return null;
  const { data } = await supabase.from('patients').select('*').eq('id', id).single();
  return (data as Patient) ?? null;
};

export const createPatient = async (
  patient: Partial<Patient> & { full_name: string }
): Promise<ServiceResult<Patient>> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { success: false, error: 'Database is not configured.' };
  const { data: userData } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('patients')
    .insert({
      full_name: patient.full_name.trim(),
      mrn: patient.mrn?.trim() || null,
      date_of_birth: patient.date_of_birth || null,
      sex: patient.sex || null,
      phone: patient.phone?.trim() || null,
      notes: patient.notes?.trim() || null,
      created_by: userData.user?.id ?? null,
    })
    .select()
    .single();

  if (error) {
    return {
      success: false,
      // The unique index on MRN is the most likely failure, and the raw
      // Postgres message doesn't say which field caused it.
      error: error.code === '23505'
        ? 'A patient with that medical record number already exists.'
        : error.message,
    };
  }
  return { success: true, data: data as Patient };
};

export const updatePatient = async (
  id: string,
  patch: Partial<Patient>
): Promise<ServiceResult<Patient>> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return { success: false, error: 'Database is not configured.' };
  const { data, error } = await supabase
    .from('patients')
    .update({
      ...(patch.full_name !== undefined ? { full_name: patch.full_name.trim() } : {}),
      ...(patch.mrn !== undefined ? { mrn: patch.mrn?.trim() || null } : {}),
      ...(patch.date_of_birth !== undefined ? { date_of_birth: patch.date_of_birth || null } : {}),
      ...(patch.sex !== undefined ? { sex: patch.sex || null } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone?.trim() || null } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
    })
    .eq('id', id)
    .select()
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, data: data as Patient };
};

/** Every assessment for one patient, oldest first, for trend charts. */
export const getPatientAssessments = async (patientId: string): Promise<PredictionRow[]> => {
  const supabase = getSupabaseBrowser();
  if (!supabase) return [];
  const { data } = await supabase
    .from('predictions')
    .select('*')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: true });
  return (data as PredictionRow[]) ?? [];
};

export interface Aggregates {
  /** Total assessments recorded. 0 means nothing has been saved yet. */
  total: number;
  /** Count per risk tier, in clinical order. */
  byTier: { label: string; value: number; color: string }[];
  /** Assessments per month for the last 6 months, oldest first. */
  monthly: { label: string; value: number }[];
  /** Count per age band. */
  byAge: { label: string; value: number; color: string }[];
  /** Mean risk score across all assessments, 0-100. */
  meanRisk: number;
  /** Assessments scoring at or above the referral threshold. */
  flagged: number;
  /** Mean of each input feature, for the "typical patient" panel. */
  featureMeans: { feature: string; label: string; mean: number }[];
  rows: PredictionRow[];
}

const TIER_COLORS: Record<string, string> = {
  'Low Risk': '#10b981',
  'Moderate Risk': '#f59e0b',
  'High Risk': '#f97316',
  'Critical Risk': '#ef4444',
};

/**
 * One query, aggregated client-side, shared by Dashboard, Analytics and
 * Reports. Returns total = 0 when nothing has been recorded, so pages can show
 * an honest empty state instead of inventing figures.
 */
export const getAggregates = async (): Promise<Aggregates> => {
  const empty: Aggregates = {
    total: 0, byTier: [], monthly: [], byAge: [], meanRisk: 0, flagged: 0,
    featureMeans: [], rows: [],
  };
  const supabase = getSupabaseBrowser();
  if (!supabase) return empty;

  const { data } = await supabase
    .from('predictions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000);

  const rows = (data as PredictionRow[]) ?? [];
  if (!rows.length) return empty;

  const tiers = ['Low Risk', 'Moderate Risk', 'High Risk', 'Critical Risk'];
  const byTier = tiers
    .map((t) => ({
      label: t.replace(' Risk', ''),
      value: rows.filter((r) => r.tier === t).length,
      color: TIER_COLORS[t],
    }))
    .filter((d) => d.value > 0);

  // Last 6 months, oldest first.
  const monthly: { label: string; value: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    monthly.push({
      label: d.toLocaleString(undefined, { month: 'short' }),
      value: rows.filter((r) => {
        const t = new Date(r.created_at);
        return t >= d && t < next;
      }).length,
    });
  }

  const bands: [string, number, number, string][] = [
    ['18–39', 0, 40, '#10b981'],
    ['40–59', 40, 60, '#f59e0b'],
    ['60–74', 60, 75, '#f97316'],
    ['75+', 75, 200, '#ef4444'],
  ];
  const byAge = bands
    .map(([label, lo, hi, color]) => ({
      label,
      value: rows.filter((r) => r.age != null && r.age >= lo && r.age < hi).length,
      color,
    }))
    .filter((d) => d.value > 0);

  const scores = rows.map((r) => Number(r.risk_probability ?? 0));
  const meanRisk = scores.reduce((a, b) => a + b, 0) / scores.length;

  const featureMeans = FEATURE_ORDER.map((f) => {
    const vals = rows
      .map((r) => r.inputs?.[f])
      .filter((v): v is number => typeof v === 'number');
    return {
      feature: f as string,
      label: FEATURE_LABELS[f],
      mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0,
    };
  }).filter((d) => d.mean > 0);

  return {
    total: rows.length,
    byTier,
    monthly,
    byAge,
    meanRisk: Math.round(meanRisk * 10) / 10,
    flagged: rows.filter((r) => r.tier === 'High Risk' || r.tier === 'Critical Risk').length,
    featureMeans,
    rows,
  };
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
