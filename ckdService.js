// ============================================================
// CKD RISK PREDICTION — Service Layer v2.2
// ============================================================
// Place this file at: lib/ckdService.js
//
// Install dependency:
//   npm install axios
//
// Add to .env.local:
//   NEXT_PUBLIC_CKD_API_URL=http://localhost:8000
// ============================================================

import axios from 'axios';

const API_BASE =
  process.env.NEXT_PUBLIC_CKD_API_URL || 'http://localhost:8000';

// ── Risk tier colour codes ────────────────────────────────────────────────────
export const RISK_COLORS = {
  'Low Risk':      '#27AE60',
  'Moderate Risk': '#F39C12',
  'High Risk':     '#E67E22',
  'Critical Risk': '#E74C3C',
};

// ── Risk tier background colours (lighter) for cards ─────────────────────────
export const RISK_BG_COLORS = {
  'Low Risk':      'rgba(39,174,96,0.15)',
  'Moderate Risk': 'rgba(243,156,18,0.15)',
  'High Risk':     'rgba(230,126,34,0.15)',
  'Critical Risk': 'rgba(231,76,60,0.15)',
};

// ── Full clinical names for feature codes ─────────────────────────────────────
export const FEATURE_LABELS = {
  hemo: 'Haemoglobin',
  sc:   'Serum Creatinine',
  pcv:  'Packed Cell Volume',
  htn:  'Hypertension',
  dm:   'Diabetes Mellitus',
  sg:   'Specific Gravity',
  al:   'Albumin Level',
  bu:   'Blood Urea',
  rbcc: 'Red Blood Cell Count',
  sod:  'Sodium',
  bgr:  'Blood Glucose Random',
  wbcc: 'WBC Count',
};

// ── Normal reference ranges ───────────────────────────────────────────────────
export const NORMAL_RANGES = {
  hemo: 'Male: 13.5–17.5 gms | Female: 12.0–15.5 gms',
  sc:   'Normal: 0.7–1.2 mgs/dL',
  pcv:  'Male: 40–52% | Female: 36–48%',
  htn:  'No = normal',
  dm:   'No = normal',
  sg:   '1.005 – 1.025',
  al:   '0 = normal (no protein in urine)',
  bu:   'Normal: 7–20 mgs/dL',
  rbcc: 'Male: 4.5–5.9 | Female: 4.1–5.1 millions/cumm',
  sod:  'Normal: 136–145 mEq/L',
  bgr:  'Normal: below 140 mgs/dL',
  wbcc: 'Normal: 4,500–11,000 cells/cumm',
};

// ── eGFR stage colour codes ───────────────────────────────────────────────────
export const EGFR_STAGE_COLORS = {
  'G1': '#27AE60',
  'G2': '#2ECC71',
  'G3a': '#F39C12',
  'G3b': '#E67E22',
  'G4': '#E74C3C',
  'G5': '#922B21',
};

// ── Helper: get eGFR stage colour ─────────────────────────────────────────────
export const getEgfrColor = (stage) => {
  const key = Object.keys(EGFR_STAGE_COLORS).find(k => stage?.startsWith(k));
  return key ? EGFR_STAGE_COLORS[key] : '#7F8C8D';
};

// ── Health check ──────────────────────────────────────────────────────────────
/**
 * Check if the API server is running.
 * Call this when the page loads to show connection status.
 */
export const checkAPIHealth = async () => {
  try {
    const response = await axios.get(`${API_BASE}/`, { timeout: 5000 });
    return {
      online:      true,
      message:     response.data.message,
      shap:        response.data.explainability?.shap || 'Unknown',
      lime:        response.data.explainability?.lime || 'Unknown',
      model:       response.data.model,
    };
  } catch {
    return {
      online:  false,
      message: 'API server is offline. Please start the server.',
    };
  }
};

// ── Manual entry prediction ───────────────────────────────────────────────────
/**
 * Send 14 typed clinical values to get a prediction.
 *
 * @param {Object} patientData - The 14 clinical values
 * @returns {Object} { success, data } or { success: false, error }
 *
 * @example
 * const result = await predictCKD({
 *   age: 45, sex: 'male',
 *   hemo: 10.5, sc: 3.8, bu: 57.0,
 *   sod: 135.0, bgr: 148.0, wbcc: 8000.0,
 *   sg: 1.010, al: 1, pcv: 32.0, rbcc: 3.9,
 *   htn: 1, dm: 1
 * });
 */
export const predictCKD = async (patientData) => {
  try {
    const response = await axios.post(`${API_BASE}/predict`, patientData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 30000,
    });
    return { success: true, data: response.data };
  } catch (error) {
    if (error.response) {
      return {
        success: false,
        error:   error.response.data?.detail || 'Prediction failed.',
        status:  error.response.status,
      };
    }
    return {
      success: false,
      error:   'Cannot connect to prediction server. Is it running?',
    };
  }
};

// ── PDF upload prediction ─────────────────────────────────────────────────────
/**
 * Upload a PDF lab report and get a full prediction.
 * The API extracts clinical values from the PDF automatically.
 *
 * @param {File} file - The PDF file from an <input type="file">
 * @returns {Object} { success, data } or { success: false, error }
 *
 * @example
 * const fileInput = document.getElementById('pdfInput');
 * const file = fileInput.files[0];
 * const result = await uploadPDFAndPredict(file);
 *
 * if (result.success) {
 *   if (result.data.extraction_status === 'incomplete') {
 *     // Show missing fields to doctor
 *   } else {
 *     // Show prediction result
 *   }
 * }
 */
export const uploadPDFAndPredict = async (file) => {
  try {
    if (!file) {
      return { success: false, error: 'No file provided.' };
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return { success: false, error: 'Only PDF files are accepted.' };
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(
      `${API_BASE}/predict/upload`,
      formData,
      {
        // Do NOT set Content-Type — axios sets it automatically
        // with the correct multipart boundary
        timeout: 60000, // 60 seconds for PDF processing
      }
    );

    return { success: true, data: response.data };
  } catch (error) {
    if (error.response) {
      const status = error.response.status;
      const detail = error.response.data?.detail || 'Upload failed.';

      // Provide user-friendly messages for known errors
      if (status === 400) {
        return { success: false, error: 'Only PDF files are accepted.' };
      }
      if (status === 422) {
        return {
          success: false,
          error: 'This PDF appears to be a scanned image and cannot be ' +
                 'read automatically. Please use the manual entry form instead.',
        };
      }
      if (status === 503) {
        return {
          success: false,
          error: 'PDF processing is not available on the server.',
        };
      }
      return { success: false, error: detail, status };
    }
    return {
      success: false,
      error: 'Cannot connect to prediction server. Is it running?',
    };
  }
};

// ── PDF extract only (no prediction) ─────────────────────────────────────────
/**
 * Extract clinical values from a PDF without running prediction.
 * Use this for the two-step flow:
 *   1. Extract → show doctor for review
 *   2. Doctor confirms/edits → call predictCKD()
 *
 * @param {File} file - The PDF file
 * @returns {Object} { success, data } with extracted_values and confidence
 */
export const extractFromPDF = async (file) => {
  try {
    if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
      return { success: false, error: 'Only PDF files are accepted.' };
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(
      `${API_BASE}/extract`,
      formData,
      { timeout: 30000 }
    );

    return { success: true, data: response.data };
  } catch (error) {
    if (error.response?.status === 422) {
      return {
        success: false,
        error: 'This PDF is a scanned image. Please use manual entry.',
      };
    }
    return {
      success: false,
      error: error.response?.data?.detail || 'Extraction failed.',
    };
  }
};

// ── Input validation ──────────────────────────────────────────────────────────
/**
 * Validate all 14 required fields before calling the API.
 * Returns { isValid, errors } where errors is an object
 * mapping field names to error messages.
 */
export const validatePatientInput = (data) => {
  const errors = {};
  const required = [
    'age','sex','hemo','sc','bu','sod','bgr',
    'wbcc','sg','al','pcv','rbcc','htn','dm'
  ];

  for (const field of required) {
    if (
      data[field] === undefined ||
      data[field] === null ||
      data[field] === ''
    ) {
      errors[field] = `${FEATURE_LABELS[field] || field} is required.`;
    }
  }

  if (data.age  && (data.age  < 1   || data.age  > 120))
    errors.age  = 'Age must be between 1 and 120.';
  if (data.hemo && (data.hemo < 0   || data.hemo > 20))
    errors.hemo = 'Haemoglobin must be between 0 and 20.';
  if (data.sc   && (data.sc   < 0   || data.sc   > 100))
    errors.sc   = 'Serum Creatinine must be between 0 and 100.';
  if (data.pcv  && (data.pcv  < 0   || data.pcv  > 60))
    errors.pcv  = 'Packed Cell Volume must be between 0 and 60.';
  if (data.al   !== undefined && (data.al < 0 || data.al > 5))
    errors.al   = 'Albumin must be between 0 and 5.';
  if (data.sex  && !['male','female'].includes(data.sex.toLowerCase()))
    errors.sex  = "Sex must be 'male' or 'female'.";
  if (data.htn  !== undefined && ![0,1].includes(Number(data.htn)))
    errors.htn  = 'Hypertension must be 0 (No) or 1 (Yes).';
  if (data.dm   !== undefined && ![0,1].includes(Number(data.dm)))
    errors.dm   = 'Diabetes must be 0 (No) or 1 (Yes).';

  return { isValid: Object.keys(errors).length === 0, errors };
};

// ── Format result for display ─────────────────────────────────────────────────
/**
 * Takes the raw API response and returns a clean display object.
 * Works for both /predict and /predict/upload responses.
 */
export const formatResult = (apiResponse) => {
  if (!apiResponse || !apiResponse.prediction) return null;

  const {
    prediction,
    risk_stratification,
    egfr,
    shap_explanations,
    lime_explanations,
    explainability_comparison,
    disclaimer,
    extraction_info,
  } = apiResponse;

  return {
    // Risk score
    riskScore:      prediction.ckd_risk_probability,
    riskLabel:      prediction.ckd_risk_label,
    predictedClass: prediction.predicted_class,

    // Risk tier
    tier:    risk_stratification.tier,
    urgency: risk_stratification.urgency,
    color:   risk_stratification.color,
    bgColor: RISK_BG_COLORS[risk_stratification.tier] || 'rgba(0,0,0,0.1)',
    action:  risk_stratification.suggested_action,

    // eGFR
    egfrValue:   egfr.value,
    egfrUnit:    egfr.unit,
    egfrStage:   egfr.stage,
    egfrEquation:egfr.equation,
    egfrColor:   getEgfrColor(egfr.stage),

    // SHAP explanations
    shapTop5: (shap_explanations?.top_5 || []).map(f => ({
      ...f,
      fullName: FEATURE_LABELS[f.feature] || f.feature,
    })),
    shapAll:  shap_explanations?.all_features || [],
    shapMethod: shap_explanations?.method || 'SHAP',

    // LIME explanations
    limeTop5: (lime_explanations?.top_5 || []).map(f => ({
      ...f,
      fullName: FEATURE_LABELS[f.feature] || f.feature,
    })),
    limeAll:  lime_explanations?.all_features || [],
    limeMethod: lime_explanations?.method || 'LIME',

    // SHAP vs LIME comparison
    comparison: explainability_comparison?.feature_agreement || [],

    // Disclaimer
    disclaimer,

    // Extraction info (only present for PDF uploads)
    isFromPDF:           !!extraction_info,
    extractionConfidence:extraction_info?.extraction_confidence || null,
    extractedValues:     extraction_info?.extracted_values || null,
    extractionWarning:   extraction_info?.warning || null,

    // Helper flags for conditional rendering
    isCritical: risk_stratification.urgency === 'CRITICAL',
    isHighRisk: ['HIGH','CRITICAL'].includes(risk_stratification.urgency),
  };
};

// ── Get features info from API ────────────────────────────────────────────────
export const getFeatureInfo = async () => {
  try {
    const response = await axios.get(`${API_BASE}/features`, { timeout: 5000 });
    return { success: true, data: response.data };
  } catch {
    return { success: false, error: 'Could not fetch feature information.' };
  }
};
