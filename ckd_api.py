"""
CKD PROBABILITY RISK PREDICTION — FastAPI Backend v2.2
=======================================================
Now includes PDF lab report upload endpoint.

NEW IN v2.2:
  POST /predict/upload — Upload a PDF lab report and get prediction
                         without manual data entry

MODEL DETAILS:
  Architecture : Calibrated Stacking Ensemble
  Base learners: Logistic Regression, Random Forest,
                 Gradient Boosting, k-NN
  Meta-learner : Logistic Regression
  Calibration  : Sigmoid (CalibratedClassifierCV, cv=5)
  Features     : 12 selected (Chi-square + RF importance, threshold 0.10)
  Dataset      : UCI CKD (400 patients, 70/30 split, SMOTE balanced)
  Accuracy     : 99.17% | Recall: 100% | ROC-AUC: 1.0000 | Brier: 0.0084

HOW TO RUN:
  cd "path/to/folder/with/pkl/files"
  pip install fastapi uvicorn joblib scikit-learn numpy pandas shap lime pdfplumber python-multipart
  uvicorn ckd_api:app --reload --host 0.0.0.0 --port 8000

INTERACTIVE DOCS:
  http://localhost:8000/docs

AUTHOR: Ernest (CKD Risk Prediction Project)
"""

import os
import re
import io
import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel,Field
from fastapi.middleware.cors import CORSMiddleware
39 from pydantic import BaseModel,Field
40 
41 def suggested_action(risk_prob):
42     if risk_prob < 0.3:
43         return "Low Risk: Maintain healthy lifestyle and regular checkups"
44     elif risk_prob < 0.7:
45         return "Medium Risk: Consult a doctor and monitor kidney function"
46     else:
47         return "High Risk: Please see a nephrologist immediately"
48 
49
# ── Load model artifacts ──────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

print("Loading model artifacts...")
try:
    model          = joblib.load(os.path.join(BASE_DIR, "ckd_action_fn.pkl"))
    scaler         = joblib.load(os.path.join(BASE_DIR, "ckd_scaler.pkl"))
    features       = joblib.load(os.path.join(BASE_DIR, "ckd_features.pkl"))
    shap_explainer = joblib.load(os.path.join(BASE_DIR, "ckd_shap_explainer.pkl"))
    X_train_smote  = joblib.load(os.path.join(BASE_DIR, "ckd_train_data.pkl"))
    print(f"✅ All artifacts loaded")
    print(f"   Model features ({len(features)}): {features}")
except Exception as e:
    print(f"❌ Error loading artifacts: {e}")
    raise

# ── Initialise LIME explainer at startup ─────────────────────────────────────
print("Initialising LIME explainer...")
try:
    from lime import lime_tabular
    lime_explainer = lime_tabular.LimeTabularExplainer(
        training_data         = X_train_smote,
        feature_names         = features,
        class_names           = ['CKD', 'Not CKD'],
        mode                  = 'classification',
        discretize_continuous = True,
        random_state          = 42
    )
    LIME_AVAILABLE = True
    print("✅ LIME explainer ready")
except Exception as e:
    LIME_AVAILABLE = False
    print(f"⚠️  LIME not available: {e}")

# ── Check pdfplumber availability ─────────────────────────────────────────────
try:
    import pdfplumber
    PDF_AVAILABLE = True
    print("✅ PDF processing ready")
except ImportError:
    PDF_AVAILABLE = False
    print("⚠️  pdfplumber not installed. Run: pip install pdfplumber")

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="CKD Probability Risk Prediction API",
    description="""
## CKD Risk Prediction API v2.2

Two ways to get a prediction:

### Option 1 — Manual entry
`POST /predict` — Clinician types the 14 clinical values directly.

### Option 2 — PDF upload
`POST /predict/upload` — Upload a PDF lab report. The system
automatically extracts the clinical values and generates the prediction.
The doctor saves time — no manual typing required.

Both options return the same complete output:
- CKD probability risk score (0–100%)
- Risk tier (Low / Moderate / High / Critical)
- Suggested clinical action
- eGFR (CKD-EPI 2021)
- SHAP feature contributions
- LIME feature contributions
- Disclaimer

### Model Performance
| Metric | Score |
|---|---|
| Accuracy | 99.17% |
| Recall | 100.00% |
| Specificity | 100.00% |
| ROC-AUC | 1.0000 |
| Brier Score | 0.0084 |

⚠️ **Disclaimer:** Decision support only. Does not replace clinical diagnosis.
    """,
    version="2.2.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Feature metadata ──────────────────────────────────────────────────────────
FEATURE_LABELS = {
    "hemo": "Haemoglobin (gms)",
    "sc":   "Serum Creatinine (mgs/dL)",
    "pcv":  "Packed Cell Volume (%)",
    "htn":  "Hypertension",
    "dm":   "Diabetes Mellitus",
    "sg":   "Specific Gravity",
    "al":   "Albumin Level",
    "bu":   "Blood Urea (mgs/dL)",
    "rbcc": "Red Blood Cell Count (millions/cumm)",
    "sod":  "Sodium (mEq/L)",
    "bgr":  "Blood Glucose Random (mgs/dL)",
    "wbcc": "WBC Count (cells/cumm)",
}

NORMAL_RANGES = {
    "hemo": "Male: 13.5–17.5 gms | Female: 12.0–15.5 gms",
    "sc":   "0.7–1.2 mgs/dL",
    "pcv":  "Male: 40–52% | Female: 36–48%",
    "htn":  "0 = No (normal) | 1 = Yes",
    "dm":   "0 = No (normal) | 1 = Yes",
    "sg":   "1.005 / 1.010 / 1.015 / 1.020 / 1.025",
    "al":   "0 = None (normal) | 1–5 = Increasing proteinuria",
    "bu":   "7–20 mgs/dL",
    "rbcc": "Male: 4.5–5.9 | Female: 4.1–5.1 millions/cumm",
    "sod":  "136–145 mEq/L",
    "bgr":  "Below 140 mgs/dL (random)",
    "wbcc": "4,500–11,000 cells/cumm",
}

# ── PDF extraction patterns ───────────────────────────────────────────────────
# Multiple patterns per feature to handle different lab report formats
EXTRACTION_PATTERNS = {
    'hemo': [
        r'haemoglobin[:\s]+([0-9]+\.?[0-9]*)',
        r'hemoglobin[:\s]+([0-9]+\.?[0-9]*)',
        r'hgb[:\s]+([0-9]+\.?[0-9]*)',
        r'\bhb\b[:\s]+([0-9]+\.?[0-9]*)',
    ],
    'sc': [
        r'serum\s*creatinine[:\s]+([0-9]+\.?[0-9]*)',
        r's\.?\s*creatinine[:\s]+([0-9]+\.?[0-9]*)',
        r'creatinine[:\s]+([0-9]+\.?[0-9]*)',
    ],
    'bu': [
        r'blood\s*urea[:\s]+([0-9]+\.?[0-9]*)',
        r'\burea\b[:\s]+([0-9]+\.?[0-9]*)',
        r'\bbun\b[:\s]+([0-9]+\.?[0-9]*)',
    ],
    'sod': [
        r'sodium[:\s]+([0-9]+\.?[0-9]*)',
        r'\bna\+?\b[:\s]+([0-9]+\.?[0-9]*)',
    ],
    'bgr': [
        r'blood\s*glucose\s*random[:\s]+([0-9]+\.?[0-9]*)',
        r'random\s*blood\s*(?:sugar|glucose)[:\s]+([0-9]+\.?[0-9]*)',
        r'\brbs\b[:\s]+([0-9]+\.?[0-9]*)',
        r'\bglucose\b[:\s]+([0-9]+\.?[0-9]*)',
    ],
    'wbcc': [
        r'wbc\s*count[:\s]+([0-9]+\.?[0-9]*)',
        r'white\s*blood\s*cell(?:\s*count)?[:\s]+([0-9]+\.?[0-9]*)',
        r'leukocytes[:\s]+([0-9]+\.?[0-9]*)',
        r'\bwbc\b[:\s]+([0-9]+\.?[0-9]*)',
    ],
    'sg': [
        r'specific\s*gravity[:\s]+([0-9]+\.?[0-9]*)',
        r'urine\s*s\.?g\.?[:\s]+([0-9]+\.?[0-9]*)',
        r'\bsg\b[:\s]+([0-9]+\.?[0-9]*)',
    ],
    'al': [
        r'albumin[:\s]+([0-9]+\.?[0-9]*)',
        r'urine\s*albumin[:\s]+([0-9]+\.?[0-9]*)',
        r'proteinuria[:\s]+([0-9]+\.?[0-9]*)',
    ],
    'pcv': [
        r'packed\s*cell\s*volume[:\s]+([0-9]+\.?[0-9]*)',
        r'haematocrit[:\s]+([0-9]+\.?[0-9]*)',
        r'hematocrit[:\s]+([0-9]+\.?[0-9]*)',
        r'\bpcv\b[:\s]+([0-9]+\.?[0-9]*)',
        r'\bhct\b[:\s]+([0-9]+\.?[0-9]*)',
    ],
    'rbcc': [
        r'rbc\s*count[:\s]+([0-9]+\.?[0-9]*)',
        r'red\s*blood\s*cell(?:\s*count)?[:\s]+([0-9]+\.?[0-9]*)',
        r'erythrocytes[:\s]+([0-9]+\.?[0-9]*)',
        r'\brbc\b[:\s]+([0-9]+\.?[0-9]*)',
    ],
    'htn': [
        r'hypertension[:\s]+(yes|no|positive|negative|present|absent)',
        r'high\s*blood\s*pressure[:\s]+(yes|no)',
        r'\bhtn\b[:\s]+(yes|no)',
    ],
    'dm': [
        r'diabetes\s*mellitus[:\s]+(yes|no|positive|negative|present|absent)',
        r'\bdiabetes\b[:\s]+(yes|no)',
        r'\bdm\b[:\s]+(yes|no)',
    ],
}

AGE_PATTERNS = [
    r'age[:\s]+([0-9]+)',
    r'age[:\s\(]+([0-9]+)\s*(?:years?|yrs?)?',
    r'([0-9]+)\s*(?:years?|yrs?)\s*old',
]

SEX_PATTERNS = [
    r'sex[:\s]+(male|female)',
    r'gender[:\s]+(male|female)',
    r'\b(male|female)\b',
]


# ── Input schema — manual entry ───────────────────────────────────────────────
class PatientInput(BaseModel):
    age:  float = Field(..., ge=1,   le=120,
                        description="Age in years (for eGFR)")
    sex:  str   = Field(...,
                        description="'male' or 'female' (for eGFR)")
    hemo: float = Field(..., ge=0,   le=20)
    sc:   float = Field(..., ge=0,   le=100)
    bu:   float = Field(..., ge=0,   le=500)
    sod:  float = Field(..., ge=0,   le=200)
    bgr:  float = Field(..., ge=0,   le=600)
    wbcc: float = Field(..., ge=0,   le=50000)
    sg:   float = Field(...)
    al:   float = Field(..., ge=0,   le=5)
    pcv:  float = Field(..., ge=0,   le=60)
    rbcc: float = Field(..., ge=0,   le=10)
    htn:  int   = Field(..., ge=0,   le=1)
    dm:   int   = Field(..., ge=0,   le=1)

    class Config:
        json_schema_extra = {
            "example": {
                "age": 45, "sex": "male",
                "hemo": 10.5, "sc": 3.8,  "bu": 57.0,
                "sod": 135.0, "bgr": 148.0, "wbcc": 8000.0,
                "sg": 1.010,  "al": 1,    "pcv": 32.0,
                "rbcc": 3.9,  "htn": 1,   "dm": 1
            }
        }


# ── Helper functions ──────────────────────────────────────────────────────────
def calculate_egfr(creatinine: float, age: float, sex: str) -> dict:
    """CKD-EPI 2021 equation."""
    sex        = sex.lower().strip()
    kappa      = 0.7    if sex == "female" else 0.9
    alpha      = -0.241 if sex == "female" else -0.302
    sex_factor = 1.012  if sex == "female" else 1.0
    ratio = creatinine / kappa
    egfr  = (142 * (ratio ** alpha)  * (0.9938 ** age) * sex_factor
             if ratio < 1 else
             142 * (ratio ** -1.200) * (0.9938 ** age) * sex_factor)
    egfr  = round(egfr, 1)
    if   egfr >= 90: stage = "G1 — Normal kidney function"
    elif egfr >= 60: stage = "G2 — Mildly decreased"
    elif egfr >= 45: stage = "G3a — Mildly to moderately decreased"
    elif egfr >= 30: stage = "G3b — Moderately to severely decreased"
    elif egfr >= 15: stage = "G4 — Severely decreased"
    else:            stage = "G5 — Kidney failure"
    return {"value": egfr, "unit": "mL/min/1.73m²",
            "stage": stage, "equation": "CKD-EPI 2021"}


def get_risk_info(prob: float) -> dict:
    """Risk stratification — matches notebook Cell 39 exactly."""
    if prob < 0.30:
        return {"tier": "Low Risk",      "urgency": "LOW",
                "color": "#27AE60",
                "action": "Routine follow-up. Reassess in 12 months."}
    elif prob < 0.60:
        return {"tier": "Moderate Risk", "urgency": "MODERATE",
                "color": "#F39C12",
                "action": "Monitor closely. Repeat tests in 3 months."}
    elif prob < 0.80:
        return {"tier": "High Risk",     "urgency": "HIGH",
                "color": "#E67E22",
                "action": "Further renal evaluation recommended."}
    else:
        return {"tier": "Critical Risk", "urgency": "CRITICAL",
                "color": "#E74C3C",
                "action": "Urgent nephrology referral strongly advised."}


def get_shap_contributions(X_scaled: np.ndarray) -> list:
    """SHAP — exact Shapley values using TreeExplainer."""
    try:
        shap_vals = shap_explainer.shap_values(X_scaled)
        if isinstance(shap_vals, list):
            vals = shap_vals[0][0]
        elif shap_vals.ndim == 3:
            vals = shap_vals[0, :, 0]
        else:
            vals = shap_vals[0]
        contributions = []
        for feat, val in zip(features, vals):
            contributions.append({
                "feature":          feat,
                "feature_name":     FEATURE_LABELS.get(feat, feat),
                "shap_value":       round(float(val), 4),
                "contribution_pct": round(abs(float(val)) * 100, 2),
                "direction":        "Increases CKD risk"
                                    if val > 0 else "Decreases CKD risk"
            })
        contributions.sort(key=lambda x: x["contribution_pct"], reverse=True)
        return contributions
    except Exception as e:
        return [{"error": f"SHAP failed: {str(e)}"}]


def get_lime_contributions(X_scaled: np.ndarray) -> list:
    """LIME — local linear approximation."""
    if not LIME_AVAILABLE:
        return [{"error": "LIME not available. pip install lime"}]
    try:
        lime_exp = lime_explainer.explain_instance(
            data_row     = X_scaled[0],
            predict_fn   = model.predict_proba,
            num_features = len(features),
            num_samples  = 1000,
            labels       = (0,)
        )
        contributions = []
        for condition, weight in lime_exp.as_list(label=0):
            match   = re.search(r'([a-zA-Z_]+)', condition)
            feat_code = match.group(1) if match else condition
            contributions.append({
                "feature":          feat_code,
                "feature_name":     FEATURE_LABELS.get(feat_code, feat_code),
                "condition":        condition,
                "lime_weight":      round(float(weight), 4),
                "contribution_pct": round(abs(float(weight)) * 100, 2),
                "direction":        "Increases CKD risk"
                                    if weight > 0 else "Decreases CKD risk"
            })
        contributions.sort(key=lambda x: x["contribution_pct"], reverse=True)
        return contributions
    except Exception as e:
        return [{"error": f"LIME failed: {str(e)}"}]


def build_comparison(shap_contribs: list, lime_contribs: list) -> list:
    """SHAP vs LIME rank comparison."""
    shap_ranks = {item["feature"]: idx + 1
                  for idx, item in enumerate(shap_contribs)
                  if "error" not in item}
    lime_ranks = {item["feature"]: idx + 1
                  for idx, item in enumerate(lime_contribs)
                  if "error" not in item}
    comparison = []
    for feat in features:
        s, l = shap_ranks.get(feat), lime_ranks.get(feat)
        if s and l:
            comparison.append({
                "feature":      feat,
                "feature_name": FEATURE_LABELS.get(feat, feat),
                "shap_rank":    s,
                "lime_rank":    l,
                "agreement":    "✅ Agree" if abs(s - l) <= 2 else "⚠️ Differ"
            })
    return comparison


def run_prediction(patient_dict: dict) -> dict:
    """
    Core prediction logic shared by both /predict and /predict/upload.
    Accepts a dict with all 14 fields and returns complete output.
    """
    # Build feature dataframe in correct order
    input_dict = {k: patient_dict[k] for k in features}
    df_input   = pd.DataFrame([input_dict])[features]
    X_scaled   = scaler.transform(df_input)

    # Predict
    prob_all    = model.predict_proba(X_scaled)
    ckd_prob    = float(np.clip(prob_all[0][0], 0.01, 0.99))
    ckd_risk_pct = round(ckd_prob * 100, 1)

    risk_info      = get_risk_info(ckd_prob)
    egfr_info      = calculate_egfr(patient_dict['sc'],
                                    patient_dict['age'],
                                    patient_dict['sex'])
    shap_contribs  = get_shap_contributions(X_scaled)
    lime_contribs  = get_lime_contributions(X_scaled)
    comparison     = build_comparison(shap_contribs, lime_contribs)

    return {
        "prediction": {
            "ckd_risk_probability": ckd_risk_pct,
            "ckd_risk_label":       f"{ckd_risk_pct}% CKD Risk",
            "predicted_class":      "CKD" if ckd_prob >= 0.5
                                    else "Not CKD",
        },
        "risk_stratification": {
            "tier":             risk_info["tier"],
            "urgency":          risk_info["urgency"],
            "color":            risk_info["color"],
            "suggested_action": risk_info["action"],
        },
        "egfr": egfr_info,
        "shap_explanations": {
            "method":       "SHAP — SHapley Additive exPlanations",
            "description":  "Exact, tree-based. Uses TreeExplainer on RF.",
            "top_5":        shap_contribs[:5],
            "all_features": shap_contribs,
        },
        "lime_explanations": {
            "method":       "LIME — Local Interpretable Model-Agnostic Explanations",
            "description":  "Local linear approximation. Model-agnostic.",
            "top_5":        lime_contribs[:5],
            "all_features": lime_contribs,
        },
        "explainability_comparison": {
            "feature_agreement": comparison,
            "note": "Agreement = rank within 2 positions between SHAP and LIME."
        },
        "disclaimer": (
            "This system is intended for risk assessment and decision "
            "support only and does not replace clinical diagnosis. "
            "All outputs must be interpreted by a qualified clinician."
        ),
        "model_info": {
            "type":        "Calibrated Stacking Ensemble",
            "calibration": "Sigmoid",
            "accuracy":    "99.17%",
            "recall":      "100.00%",
            "specificity": "100.00%",
            "f1_score":    "99.34%",
            "roc_auc":     "1.0000",
            "brier_score": "0.0084"
        }
    }


def extract_from_pdf_text(text: str) -> dict:
    """
    Extract all 14 clinical values from raw PDF text.
    Handles multiple lab report formats using regex patterns.
    Returns extracted values and a list of any missing fields.
    """
    text_lower = text.lower()
    extracted  = {}

    # Extract 12 model features
    for feat, patterns_list in EXTRACTION_PATTERNS.items():
        for pattern in patterns_list:
            match = re.search(pattern, text_lower)
            if match:
                val = match.group(1).strip()
                if feat in ['htn', 'dm']:
                    extracted[feat] = 1 if val in [
                        'yes','positive','present'] else 0
                else:
                    try:
                        extracted[feat] = float(val)
                    except ValueError:
                        continue
                break  # stop at first successful match

    # Extract age
    for pattern in AGE_PATTERNS:
        match = re.search(pattern, text_lower)
        if match:
            try:
                extracted['age'] = float(match.group(1))
                break
            except ValueError:
                continue

    # Extract sex
    for pattern in SEX_PATTERNS:
        match = re.search(pattern, text_lower)
        if match:
            val = match.group(1).lower()
            extracted['sex'] = 'male' if val in ['male', 'm'] else 'female'
            break

    # Identify missing fields
    all_fields  = features + ['age', 'sex']
    missing     = [f for f in all_fields if f not in extracted]
    extraction_confidence = round(
        (len(all_fields) - len(missing)) / len(all_fields) * 100, 1)

    return {
        "extracted_values":       extracted,
        "missing_fields":         missing,
        "extraction_confidence":  extraction_confidence,
        "total_fields_expected":  len(all_fields),
        "total_fields_extracted": len(all_fields) - len(missing)
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    """Health check."""
    return {
        "status":  "online",
        "message": "CKD Risk Prediction API v2.2 is running",
        "input_options": {
            "manual_entry": "POST /predict — type 14 values",
            "pdf_upload":   "POST /predict/upload — upload PDF lab report"
        },
        "explainability": {
            "shap": "✅ Available",
            "lime": "✅ Available" if LIME_AVAILABLE else "❌ pip install lime"
        },
        "model": {
            "type":        "Calibrated Stacking Ensemble",
            "accuracy":    "99.17%",
            "recall":      "100.00%",
            "roc_auc":     "1.0000"
        }
    }


@app.get("/features", tags=["Info"])
def get_features():
    """12 model features with descriptions and normal ranges."""
    return {
        "selected_features": features,
        "total":             len(features),
        "details": {
            f: {
                "full_name":    FEATURE_LABELS.get(f, f),
                "normal_range": NORMAL_RANGES.get(f, "")
            } for f in features
        }
    }


@app.post("/predict", tags=["Prediction — Manual Entry"])
def predict(patient: PatientInput):
    """
    Manual entry prediction.
    Clinician types all 14 clinical values directly.
    """
    try:
        patient_dict = {
            "age": patient.age, "sex": patient.sex,
            "hemo": patient.hemo, "sc":   patient.sc,
            "pcv":  patient.pcv,  "htn":  patient.htn,
            "dm":   patient.dm,   "sg":   patient.sg,
            "al":   patient.al,   "bu":   patient.bu,
            "rbcc": patient.rbcc, "sod":  patient.sod,
            "bgr":  patient.bgr,  "wbcc": patient.wbcc,
        }
        return run_prediction(patient_dict)
    except Exception as e:
        raise HTTPException(status_code=500,
                            detail=f"Prediction failed: {str(e)}")


@app.post("/predict/upload", tags=["Prediction — PDF Upload"])
async def predict_from_pdf(file: UploadFile = File(...)):
    """
    PDF lab report upload prediction.

    The doctor uploads a PDF lab result. The system:
    1. Extracts text from the PDF
    2. Parses all clinical values using pattern matching
    3. Runs the prediction
    4. Returns the full result

    ⚠️ IMPORTANT: The frontend should always show the extracted values
    to the doctor for verification before displaying the final prediction.
    Extraction confidence is included in the response so the frontend
    can decide whether to show a review step.

    Accepted file types: PDF only (.pdf)
    """
    if not PDF_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="PDF processing not available. "
                   "Install with: pip install pdfplumber"
        )

    # Validate file type
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are accepted. "
                   "Please upload a .pdf lab report."
        )

    try:
        # Read PDF content
        pdf_bytes = await file.read()

        # Extract text from all pages
        full_text = ""
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    full_text += page_text + "\n"

        if not full_text.strip():
            raise HTTPException(
                status_code=422,
                detail="Could not extract text from this PDF. "
                       "The file may be scanned or image-based. "
                       "Please use the manual entry option instead."
            )

        # Extract clinical values
        extraction_result = extract_from_pdf_text(full_text)
        extracted         = extraction_result["extracted_values"]
        missing           = extraction_result["missing_fields"]
        confidence        = extraction_result["extraction_confidence"]

        # Check if critical fields are missing
        critical_missing = [f for f in missing if f in features]
        if critical_missing:
            return {
                "extraction_status":  "incomplete",
                "extraction_confidence": confidence,
                "extracted_values":   extracted,
                "missing_fields":     missing,
                "critical_missing":   critical_missing,
                "message": (
                    f"Could not extract {len(critical_missing)} required "
                    f"field(s): {critical_missing}. "
                    f"Please enter these values manually using POST /predict, "
                    f"or check that the lab report contains these parameters."
                ),
                "extracted_text_preview": full_text[:500]
            }

        # Run prediction with extracted values
        result = run_prediction(extracted)

        # Add extraction metadata to response
        result["extraction_info"] = {
            "status":                "success",
            "filename":              file.filename,
            "extraction_confidence": confidence,
            "fields_extracted":      extraction_result["total_fields_extracted"],
            "fields_expected":       extraction_result["total_fields_expected"],
            "extracted_values": {
                FEATURE_LABELS.get(k, k): v
                for k, v in extracted.items()
                if k in features
            },
            "warning": (
                "Please verify the extracted values above match the "
                "original lab report before trusting this prediction. "
                "The system may occasionally misread values from "
                "non-standard report formats."
            ) if confidence < 100 else None
        }

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"PDF processing failed: {str(e)}"
        )


@app.post("/extract", tags=["PDF — Extract Only"])
async def extract_only(file: UploadFile = File(...)):
    """
    Extract clinical values from a PDF without running prediction.

    Use this endpoint if you want to show the doctor the extracted
    values for review before sending them to POST /predict manually.
    This gives the doctor full control to correct any extraction errors.

    Returns: extracted values, missing fields, confidence score.
    """
    if not PDF_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="PDF processing not available. pip install pdfplumber"
        )

    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400,
                            detail="Only PDF files are accepted.")

    try:
        pdf_bytes = await file.read()
        full_text = ""
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    full_text += page_text + "\n"

        if not full_text.strip():
            raise HTTPException(
                status_code=422,
                detail="Could not extract text from this PDF."
            )

        extraction_result = extract_from_pdf_text(full_text)
        extracted         = extraction_result["extracted_values"]

        return {
            "extraction_status":     "success",
            "filename":              file.filename,
            "extraction_confidence": extraction_result["extraction_confidence"],
            "fields_extracted":      extraction_result["total_fields_extracted"],
            "fields_expected":       extraction_result["total_fields_expected"],
            "extracted_values":      extracted,
            "missing_fields":        extraction_result["missing_fields"],
            "display_values": {
                FEATURE_LABELS.get(k, k): v
                for k, v in extracted.items()
                if k in features
            },
            "instructions": (
                "Review the extracted values above. If all values are "
                "correct, send them to POST /predict to get the prediction. "
                "If any values are wrong, correct them before submitting."
            )
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Extraction failed: {str(e)}"
        )


@app.post("/predict/batch", tags=["Prediction — Manual Entry"])
def predict_batch(patients: list[PatientInput]):
    """Batch manual prediction — maximum 50 patients."""
    if len(patients) > 50:
        raise HTTPException(status_code=400,
                            detail="Maximum 50 patients per batch.")
    results = []
    for i, patient in enumerate(patients):
        try:
            result = predict(patient)
            result["patient_index"] = i + 1
            results.append(result)
        except Exception as e:
            results.append({"patient_index": i + 1, "error": str(e)})
    return {"total_patients": len(patients), "results": results}
