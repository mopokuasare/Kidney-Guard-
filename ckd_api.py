"""
Kidney Disease Risk Prediction API
NHANES 2021-2023 | KDIGO 2024 | Stacking Ensemble (RF + GB + XGBoost -> LR)
FastAPI + uvicorn

Model artifacts were saved with scikit-learn 1.8.0 + numpy 2.x, so those
versions are pinned in requirements.txt (older versions fail to unpickle).

Inference chain (must match the training notebook exactly):
    raw features -> median/mode imputation -> StandardScaler -> calibrated
    stacking ensemble -> P(KD risk) -> threshold -> risk band
"""

import os

import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

# ── Load model files ─────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "nhanes_model_files")

# SHAP roughly +33 MB RSS on top of the ~240 MB model. Comfortable on a
# 512 MB Render instance, but set ENABLE_SHAP=0 to drop it if memory gets tight.
ENABLE_SHAP = os.getenv("ENABLE_SHAP", "1").lower() not in ("0", "false", "no")


def load_pkl(name):
    # joblib.load reads both joblib-compressed artifacts and plain pickles.
    return joblib.load(os.path.join(MODEL_DIR, name))


print("Loading NHANES model artifacts...")
calibrated_model = load_pkl("calibrated_model.pkl")
scaler = load_pkl("scaler.pkl")
imputation_values = load_pkl("imputation_values.pkl")
optimal_threshold = float(load_pkl("threshold.pkl"))
features = load_pkl("features.pkl")
print(f"[OK] Model loaded. Features ({len(features)}): {features}")
print(f"[OK] Threshold: {optimal_threshold:.4f}")

# Training medians (continuous) and modes (binary), used to fill omitted fields.
IMPUTE_MEDIANS = imputation_values.get("medians", {})
IMPUTE_MODES = imputation_values.get("modes", {})

shap_explainer = None
if ENABLE_SHAP:
    try:
        shap_explainer = load_pkl("shap_explainer.pkl")
        print("[OK] SHAP explainer loaded (/explain enabled)")
    except FileNotFoundError:
        print("[WARN] shap_explainer.pkl not found - /explain disabled")
    except Exception as exc:  # noqa: BLE001 - never block startup on SHAP
        print(f"[WARN] SHAP explainer failed to load ({exc}) - /explain disabled")
else:
    print("[INFO] ENABLE_SHAP=0 - /explain disabled")


# ── Risk stratification ──────────────────────────────────────────
# The Low/Moderate boundary is pinned to the decision threshold so the band and
# the screening flag cannot contradict each other. Before this, with the
# recall-oriented threshold at 0.0875 against a hard-coded 0.25 boundary, a
# patient could be flagged "KD Risk" while being told "Low Risk - reassess in
# 12 months", which defeats the point of a sensitive threshold.
#
# The upper boundaries (0.50 referral, 0.75 urgent) are the clinical
# stratification from the training notebook and are deliberately unchanged.
_LOW_MAX = round(optimal_threshold, 4)

RISK_BANDS = [
    (0.00, _LOW_MAX, "Low Risk", "Routine",
     "No strong indicators of kidney disease detected. "
     "Routine follow-up recommended. Reassess in 12 months."),
    (_LOW_MAX, 0.50, "Moderate Risk", "Monitor",
     "Some clinical markers present. Borderline profile. "
     "Repeat laboratory tests in 3 months. "
     "Monitor blood pressure and diabetes control closely."),
    (0.50, 0.75, "High Risk", "Refer",
     "Clinical profile strongly suggestive of kidney disease. "
     "Nephrology referral recommended. "
     "Full renal function workup advised."),
    (0.75, 1.01, "Critical Risk", "Urgent",
     "Clinical profile highly consistent with kidney disease. "
     "Urgent nephrology referral required. "
     "Immediate further evaluation necessary."),
]

FEATURE_LABELS = {
    "serum_creatinine": "Serum Creatinine",
    "blood_urea_nitrogen": "Blood Urea Nitrogen",
    "bp_systolic": "Systolic Blood Pressure",
    "age": "Age",
    "diabetes_diagnosed": "Diabetes Diagnosed",
    "albumin_serum": "Serum Albumin",
    "bmi": "Body Mass Index",
    "ever_smoked": "Ever Smoked",
}


def get_risk_stratification(prob: float) -> dict:
    for low, high, level, urgency, action in RISK_BANDS:
        if low <= prob < high:
            return {"level": level, "urgency": urgency, "action": action}
    return {"level": "Critical Risk", "urgency": "Urgent",
            "action": RISK_BANDS[-1][4]}


# ── FastAPI setup ────────────────────────────────────────────────
app = FastAPI(
    title="Kidney Disease Risk Prediction API",
    description=(
        "ML decision support system trained on CDC NHANES 2021-2023. "
        "KDIGO 2024 staging via CKD-EPI 2021 race-free eGFR equation. "
        "For research and decision support only. "
        "Not a substitute for clinical diagnosis."
    ),
    version="1.1.0",
)

# Browsers reject `Access-Control-Allow-Origin: *` on credentialed requests, so
# wildcard and credentials are mutually exclusive. Set ALLOWED_ORIGINS to a
# comma-separated list (e.g. your Vercel URL) to enable cookie/auth requests.
_origins_env = os.getenv("ALLOWED_ORIGINS", "").strip()
if _origins_env:
    allow_origins = [o.strip() for o in _origins_env.split(",") if o.strip()]
    allow_credentials = True
else:
    allow_origins = ["*"]
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)
print(f"[OK] CORS origins: {allow_origins} (credentials={allow_credentials})")


# ── Request schema ───────────────────────────────────────────────
class PatientFeatures(BaseModel):
    """All fields optional: omitted values fall back to the training
    median (continuous) or mode (binary), matching the notebook's imputation."""

    serum_creatinine: float | None = Field(None, gt=0, le=30,
                                           description="Serum Creatinine (mg/dl)")
    blood_urea_nitrogen: float | None = Field(None, gt=0, le=200,
                                              description="Blood Urea Nitrogen (mg/dl)")
    bp_systolic: float | None = Field(None, gt=60, le=260,
                                      description="Systolic Blood Pressure (mm/Hg)")
    age: float | None = Field(None, ge=0, le=120, description="Age (years)")
    diabetes_diagnosed: int | None = Field(None, ge=0, le=1,
                                           description="Diabetes Diagnosed - 1=Yes 0=No")
    albumin_serum: float | None = Field(None, gt=0, le=10,
                                        description="Serum Albumin (g/dl)")
    bmi: float | None = Field(None, gt=10, le=100, description="Body Mass Index (kg/m2)")
    ever_smoked: int | None = Field(None, ge=0, le=1,
                                    description="Ever Smoked - 1=Yes 0=No")

    @field_validator("diabetes_diagnosed", "ever_smoked")
    @classmethod
    def must_be_binary(cls, v):
        if v is not None and v not in (0, 1):
            raise ValueError("Must be 0 or 1")
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "serum_creatinine": 0.83, "blood_urea_nitrogen": 14.0,
                "bp_systolic": 118.0, "age": 52.0, "diabetes_diagnosed": 0,
                "albumin_serum": 4.1, "bmi": 27.7, "ever_smoked": 0,
            }
        }
    }


# ── Response schema ──────────────────────────────────────────────
class RiskAssessment(BaseModel):
    patient_features: dict
    imputed_features: list
    kd_risk_score: float
    kd_risk_percentage: str
    predicted_class: str
    predicted_class_int: int
    probability_no_kd_risk: float
    probability_kd_risk: float
    risk_level: str
    urgency: str
    action: str
    threshold_used: float
    model: str
    dataset: str
    standard: str
    disclaimer: str


class FeatureContribution(BaseModel):
    feature: str
    label: str
    value: float
    shap_value: float
    abs_contribution_pct: float
    direction: str


class Explanation(BaseModel):
    kd_risk_score: float
    predicted_class: str
    base_value: float
    contributions: list[FeatureContribution]
    top_drivers: list[str]
    method: str
    disclaimer: str


class HealthResponse(BaseModel):
    status: str
    model: str
    features: list
    threshold: float
    version: str
    shap_enabled: bool


# ── Core inference ───────────────────────────────────────────────
def build_feature_vector(patient: "PatientFeatures"):
    """Return (X, resolved_values, imputed_field_names) in model feature order."""
    row, resolved, imputed = [], {}, []
    for f in features:
        v = getattr(patient, f)
        if v is None:
            if f in IMPUTE_MEDIANS:
                v = IMPUTE_MEDIANS[f]
            elif f in IMPUTE_MODES:
                v = IMPUTE_MODES[f]
            else:
                raise HTTPException(
                    status_code=422,
                    detail=f"'{f}' is required and has no imputation value.",
                )
            imputed.append(f)
        resolved[f] = float(v)
        row.append(float(v))
    X = np.array(row, dtype=np.float64).reshape(1, -1)
    return X, resolved, imputed


def run_prediction(patient: "PatientFeatures"):
    X, resolved, imputed = build_feature_vector(patient)
    X_scaled = scaler.transform(X)

    probs = calibrated_model.predict_proba(X_scaled)[0]
    # Clip both tails together so the two probabilities still sum to 1.
    prob_kd = float(np.clip(probs[1], 0.001, 0.999))
    prob_no_kd = 1.0 - prob_kd

    pred_int = int(prob_kd >= optimal_threshold)
    pred_label = "KD Risk" if pred_int == 1 else "No KD Risk"
    strat = get_risk_stratification(prob_kd)

    return X_scaled, resolved, imputed, prob_kd, prob_no_kd, pred_int, pred_label, strat


# ── Routes ───────────────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "message": "Kidney Disease Risk Prediction API",
        "docs": "/docs",
        "health": "/health",
        "predict": "/predict",
        "explain": "/explain" if shap_explainer is not None else None,
    }


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="healthy",
        model="Stacking Ensemble (RF + GB + XGBoost -> LR)",
        features=features,
        threshold=round(optimal_threshold, 4),
        version="1.1.0",
        shap_enabled=shap_explainer is not None,
    )


@app.post("/predict", response_model=RiskAssessment)
def predict(patient: PatientFeatures):
    try:
        (_, resolved, imputed, prob_kd, prob_no_kd,
         pred_int, pred_label, strat) = run_prediction(patient)

        return RiskAssessment(
            patient_features=resolved,
            imputed_features=imputed,
            kd_risk_score=round(prob_kd, 4),
            kd_risk_percentage=f"{prob_kd * 100:.1f}%",
            predicted_class=pred_label,
            predicted_class_int=pred_int,
            probability_no_kd_risk=round(prob_no_kd, 4),
            probability_kd_risk=round(prob_kd, 4),
            risk_level=strat["level"],
            urgency=strat["urgency"],
            action=strat["action"],
            threshold_used=round(optimal_threshold, 4),
            model="Stacking Ensemble - RF + GB + XGBoost -> LR",
            dataset="CDC NHANES 2021-2023 | 6,326 patients",
            standard="KDIGO 2024 | CKD-EPI 2021 race-free eGFR",
            disclaimer=(
                "For research and decision support purposes only. "
                "Not a substitute for clinical diagnosis."
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/explain", response_model=Explanation)
def explain(patient: PatientFeatures):
    """Per-patient SHAP attribution for the KD-risk class.

    Attributions come from the Random Forest base learner (the notebook's
    TreeExplainer), so they explain the ensemble's dominant signal rather than
    the calibrated probability exactly. Use for direction and ranking.
    """
    if shap_explainer is None:
        raise HTTPException(
            status_code=503,
            detail="SHAP explainer is not loaded on this instance.",
        )
    try:
        (X_scaled, resolved, _, prob_kd, _,
         _, pred_label, _) = run_prediction(patient)

        raw = shap_explainer.shap_values(X_scaled)
        # TreeExplainer returns list-per-class, a 3-D array, or a 2-D array
        # depending on version. Normalise to the positive (KD risk) class.
        if isinstance(raw, list):
            vals = np.asarray(raw[1])[0]
            base = shap_explainer.expected_value
            base = float(base[1] if np.ndim(base) > 0 else base)
        else:
            arr = np.asarray(raw)
            if arr.ndim == 3:
                vals = arr[0, :, 1]
                base = shap_explainer.expected_value
                base = float(base[1] if np.ndim(base) > 0 else base)
            else:
                vals = arr[0]
                base = shap_explainer.expected_value
                base = float(np.ravel(base)[0])

        vals = np.asarray(vals, dtype=float).ravel()
        total = float(np.abs(vals).sum()) or 1.0

        contributions = [
            FeatureContribution(
                feature=f,
                label=FEATURE_LABELS.get(f, f),
                value=resolved[f],
                shap_value=round(float(v), 6),
                abs_contribution_pct=round(abs(float(v)) / total * 100, 2),
                direction="increases risk" if v > 0 else "reduces risk",
            )
            for f, v in zip(features, vals)
        ]
        contributions.sort(key=lambda c: -c.abs_contribution_pct)

        return Explanation(
            kd_risk_score=round(prob_kd, 4),
            predicted_class=pred_label,
            base_value=round(base, 6),
            contributions=contributions,
            top_drivers=[c.label for c in contributions[:3]],
            method="SHAP TreeExplainer (Random Forest base learner)",
            disclaimer=(
                "Attributions describe the model's reasoning, not clinical "
                "causation. For research and decision support only."
            ),
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict/batch")
def predict_batch(patients: list[PatientFeatures]):
    if len(patients) > 100:
        raise HTTPException(
            status_code=400,
            detail="Maximum 100 patients per batch request",
        )
    # One bad row shouldn't fail the whole batch - report it per index instead.
    out = []
    for i, p in enumerate(patients):
        try:
            out.append(predict(p))
        except HTTPException as e:
            out.append({"index": i, "error": e.detail, "status": e.status_code})
    return out


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("ckd_api:app", host="0.0.0.0", port=port)
