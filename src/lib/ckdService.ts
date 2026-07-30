const API_BASE =
  process.env.NEXT_PUBLIC_CKD_API_URL || 'http://localhost:8000';

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface PatientInput {
  age: number;
  sex: 'male' | 'female';
  hemo: number;
  sc: number;
  bu: number;
  sod: number;
  bgr: number;
  wbcc: number;
  sg: number;
  al: number;
  pcv: number;
  rbcc: number;
  htn: 0 | 1;
  dm: 0 | 1;
}

export interface ShapFeature {
  feature: string;
  feature_name: string;
  shap_value?: number;
  contribution_pct: number;
  direction: string;
}

export interface PredictionResponse {
  prediction: {
    ckd_risk_probability: number;
    ckd_risk_label: string;
    predicted_class: string;
  };
  risk_stratification: {
    tier: string;
    urgency: string;
    color: string;
    suggested_action: string;
  };
  egfr: {
    value: number;
    unit: string;
    stage: string;
    equation: string;
  };
  shap_explanations?: { top_5?: ShapFeature[]; all_features?: ShapFeature[]; method?: string };
  lime_explanations?: { top_5?: ShapFeature[]; all_features?: ShapFeature[]; method?: string };
  explainability_comparison?: { feature_agreement?: unknown[] };
  disclaimer: string;
  extraction_info?: {
    status: string;
    filename: string;
    extraction_confidence: number;
    extracted_values: Record<string, number>;
    warning: string | null;
  };
  // present on incomplete PDF extraction
  extraction_status?: 'incomplete';
  missing_fields?: string[];
  critical_missing?: string[];
  extracted_values?: Record<string, number>;
  message?: string;
}

export type ServiceResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; status?: number };

/* ── Constants (from API docs) ─────────────────────────────────────────────── */

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

export const FEATURE_LABELS: Record<string, string> = {
  hemo: 'Haemoglobin',
  sc: 'Serum Creatinine',
  pcv: 'Packed Cell Volume',
  htn: 'Hypertension',
  dm: 'Diabetes Mellitus',
  sg: 'Specific Gravity',
  al: 'Albumin Level',
  bu: 'Blood Urea',
  rbcc: 'Red Blood Cell Count',
  sod: 'Sodium',
  bgr: 'Blood Glucose Random',
  wbcc: 'WBC Count',
};

export const NORMAL_RANGES: Record<string, string> = {
  hemo: 'Male: 13.5–17.5 gms | Female: 12.0–15.5 gms',
  sc: 'Normal: 0.7–1.2 mgs/dL',
  pcv: 'Male: 40–52% | Female: 36–48%',
  htn: 'No = normal',
  dm: 'No = normal',
  sg: '1.005 – 1.025',
  al: '0 = normal (no protein in urine)',
  bu: 'Normal: 7–20 mgs/dL',
  rbcc: 'Male: 4.5–5.9 | Female: 4.1–5.1 millions/cumm',
  sod: 'Normal: 136–145 mEq/L',
  bgr: 'Normal: below 140 mgs/dL',
  wbcc: 'Normal: 4,500–11,000 cells/cumm',
};

export const EGFR_STAGE_COLORS: Record<string, string> = {
  G1: '#27AE60',
  G2: '#2ECC71',
  G3a: '#F39C12',
  G3b: '#E67E22',
  G4: '#E74C3C',
  G5: '#922B21',
};

export const getEgfrColor = (stage?: string): string => {
  const key = Object.keys(EGFR_STAGE_COLORS).find((k) => stage?.startsWith(k));
  return key ? EGFR_STAGE_COLORS[key] : '#7F8C8D';
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
    const res = await fetch(`${API_BASE}/`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { online: false, message: 'API returned an error.' };
    const data = await res.json();
    return { online: true, message: data.message, model: data.model };
  } catch {
    return { online: false, message: 'API server is offline. Please start the server.' };
  }
};

/* ── Manual entry prediction ───────────────────────────────────────────────── */

export const predictCKD = async (
  patientData: PatientInput
): Promise<ServiceResult<PredictionResponse>> => {
  try {
    const res = await fetch(`${API_BASE}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patientData),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return { success: false, error: extractDetail(data) || 'Prediction failed.', status: res.status };
    }
    return { success: true, data: data as PredictionResponse };
  } catch {
    return { success: false, error: 'Cannot connect to prediction server. Is it running?' };
  }
};

/* ── PDF upload → full prediction ──────────────────────────────────────────── */

export const uploadPdfAndPredict = async (
  file: File
): Promise<ServiceResult<PredictionResponse>> => {
  const validation = validatePdfFile(file);
  if (validation) return { success: false, error: validation };

  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(`${API_BASE}/predict/upload`, { method: 'POST', body: formData });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { success: false, error: friendlyUploadError(res.status, data), status: res.status };
    return { success: true, data: data as PredictionResponse };
  } catch {
    return { success: false, error: 'Cannot connect to prediction server. Is it running?' };
  }
};

/* ── PDF extract only (two-step verify flow) ───────────────────────────────── */

export interface ExtractionResponse {
  extraction_status?: string;
  extracted_values: Record<string, number>;
  missing_fields: string[];
  extraction_confidence?: number;
  [key: string]: unknown;
}

export const extractFromPdf = async (
  file: File
): Promise<ServiceResult<ExtractionResponse>> => {
  const validation = validatePdfFile(file);
  if (validation) return { success: false, error: validation };

  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(`${API_BASE}/extract`, { method: 'POST', body: formData });
    const data = await res.json().catch(() => null);
    if (!res.ok) return { success: false, error: friendlyUploadError(res.status, data), status: res.status };
    return { success: true, data: data as ExtractionResponse };
  } catch {
    return { success: false, error: 'Cannot connect to prediction server. Is it running?' };
  }
};

export const getFeatureInfo = async (): Promise<ServiceResult<unknown>> => {
  try {
    const res = await fetch(`${API_BASE}/features`);
    if (!res.ok) return { success: false, error: 'Could not fetch feature information.' };
    return { success: true, data: await res.json() };
  } catch {
    return { success: false, error: 'Could not fetch feature information.' };
  }
};

/* ── Input validation (impossible-value guards) ────────────────────────────── */

export const validatePatientInput = (
  data: Partial<Record<keyof PatientInput, unknown>>
): { isValid: boolean; errors: Partial<Record<keyof PatientInput, string>> } => {
  const errors: Partial<Record<keyof PatientInput, string>> = {};
  const required: (keyof PatientInput)[] = [
    'age', 'sex', 'hemo', 'sc', 'bu', 'sod', 'bgr', 'wbcc', 'sg', 'al', 'pcv', 'rbcc', 'htn', 'dm',
  ];

  for (const field of required) {
    const v = data[field];
    if (v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v))) {
      errors[field] = `${FEATURE_LABELS[field] || field} is required.`;
    }
  }

  const num = (k: keyof PatientInput) => Number(data[k]);
  if (data.age != null && (num('age') < 1 || num('age') > 120)) errors.age = 'Age must be between 1 and 120.';
  if (data.hemo != null && (num('hemo') < 0 || num('hemo') > 20)) errors.hemo = 'Haemoglobin must be between 0 and 20.';
  if (data.sc != null && (num('sc') < 0 || num('sc') > 100)) errors.sc = 'Serum Creatinine must be between 0 and 100.';
  if (data.bu != null && (num('bu') < 0 || num('bu') > 500)) errors.bu = 'Blood Urea must be between 0 and 500.';
  if (data.sod != null && (num('sod') < 0 || num('sod') > 200)) errors.sod = 'Sodium must be between 0 and 200.';
  if (data.bgr != null && (num('bgr') < 0 || num('bgr') > 600)) errors.bgr = 'Blood Glucose must be between 0 and 600.';
  if (data.wbcc != null && (num('wbcc') < 0 || num('wbcc') > 50000)) errors.wbcc = 'WBC must be between 0 and 50000.';
  if (data.pcv != null && (num('pcv') < 0 || num('pcv') > 60)) errors.pcv = 'Packed Cell Volume must be between 0 and 60.';
  if (data.rbcc != null && (num('rbcc') < 0 || num('rbcc') > 10)) errors.rbcc = 'RBC Count must be between 0 and 10.';
  if (data.al != null && (num('al') < 0 || num('al') > 5)) errors.al = 'Albumin must be between 0 and 5.';
  if (data.sex != null && !['male', 'female'].includes(String(data.sex).toLowerCase())) errors.sex = "Sex must be 'male' or 'female'.";
  if (data.htn != null && ![0, 1].includes(Number(data.htn))) errors.htn = 'Hypertension must be 0 or 1.';
  if (data.dm != null && ![0, 1].includes(Number(data.dm))) errors.dm = 'Diabetes must be 0 or 1.';

  return { isValid: Object.keys(errors).length === 0, errors };
};

/* ── Format result for display ─────────────────────────────────────────────── */

export interface FormattedResult {
  riskScore: number;
  riskLabel: string;
  predictedClass: string;
  tier: string;
  urgency: string;
  color: string;
  bgColor: string;
  action: string;
  egfrValue: number;
  egfrUnit: string;
  egfrStage: string;
  egfrEquation: string;
  egfrColor: string;
  shapTop5: (ShapFeature & { fullName: string })[];
  limeTop5: (ShapFeature & { fullName: string })[];
  disclaimer: string;
  isFromPdf: boolean;
  extractionConfidence: number | null;
  extractedValues: Record<string, number> | null;
  isCritical: boolean;
  isHighRisk: boolean;
}

export const formatResult = (resp: PredictionResponse | null): FormattedResult | null => {
  if (!resp || !resp.prediction) return null;
  const { prediction, risk_stratification, egfr, shap_explanations, lime_explanations, disclaimer, extraction_info } = resp;

  return {
    riskScore: prediction.ckd_risk_probability,
    riskLabel: prediction.ckd_risk_label,
    predictedClass: prediction.predicted_class,
    tier: risk_stratification.tier,
    urgency: risk_stratification.urgency,
    color: risk_stratification.color,
    bgColor: RISK_BG_COLORS[risk_stratification.tier] || 'rgba(0,0,0,0.1)',
    action: risk_stratification.suggested_action,
    egfrValue: egfr.value,
    egfrUnit: egfr.unit,
    egfrStage: egfr.stage,
    egfrEquation: egfr.equation,
    egfrColor: getEgfrColor(egfr.stage),
    shapTop5: (shap_explanations?.top_5 || []).map((f) => ({ ...f, fullName: FEATURE_LABELS[f.feature] || f.feature_name || f.feature })),
    limeTop5: (lime_explanations?.top_5 || []).map((f) => ({ ...f, fullName: FEATURE_LABELS[f.feature] || f.feature_name || f.feature })),
    disclaimer,
    isFromPdf: !!extraction_info,
    extractionConfidence: extraction_info?.extraction_confidence ?? null,
    extractedValues: extraction_info?.extracted_values ?? null,
    isCritical: risk_stratification.urgency === 'CRITICAL',
    isHighRisk: ['HIGH', 'CRITICAL'].includes(risk_stratification.urgency),
  };
};



export const savePrediction = async (
  _input: PatientInput,
  _result: PredictionResponse
): Promise<void> => {
  // no-op until Supabase is configured
  return;
};


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

function validatePdfFile(file: File | null): string | null {
  if (!file) return 'No file provided.';
  if (!file.name.toLowerCase().endsWith('.pdf')) return 'Only PDF files are accepted.';
  return null;
}

function friendlyUploadError(status: number, data: unknown): string {
  if (status === 400) return 'Only PDF files are accepted.';
  if (status === 422) return 'This PDF appears to be a scanned image and cannot be read automatically. Please use the manual entry form instead.';
  if (status === 503) return 'PDF processing is not available on the server.';
  return extractDetail(data) || 'Upload failed.';
}
