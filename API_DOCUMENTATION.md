# Kidney Disease Risk Prediction API

Backend for KidneyGuard. Detects likely kidney disease from 8 routine clinical
measurements using a calibrated stacking ensemble trained on CDC NHANES 2021–2023.

- **Model**: Stacking ensemble — Random Forest + Gradient Boosting + XGBoost → Logistic Regression meta-learner
- **Calibration**: Selected by Brier score (sigmoid/Platt vs isotonic)
- **Decision threshold**: `0.4439` (F1-optimal, learned on the held-out test set)
- **Standard**: KDIGO 2024 · CKD-EPI 2021 race-free eGFR

> For research and decision support only. Not a substitute for clinical diagnosis.

> ### ⚠️ Not cleared for production
> The current model is trained on a **mislabelled target**: `ckd_present` counts
> eGFR 60–89 without kidney damage as CKD, which KDIGO does not. This inflates
> prevalence from 16.7% to 43.2% and makes the label largely a proxy for age.
> A 52-year-old with entirely normal labs scores **74.2%**, and response to
> creatinine is non-monotonic. See **[MODEL_VALIDATION.md](MODEL_VALIDATION.md)**
> for the full analysis and the fix. Do not deploy until the label is corrected
> and the model retrained.
>
> Any documentation claiming this example returns **9.8%** (including the
> `README_API.md` bundled with the model artifacts) is **incorrect** — no model
> version ever produced that value. Measured outputs are tabulated below.

---

## Running locally

```bash
pip install -r requirements.txt
```

```bash
uvicorn ckd_api:app --reload --port 8000
```

Interactive docs at `http://localhost:8000/docs`. Run the smoke tests with:

```bash
python test_api.py
```

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `ALLOWED_ORIGINS` | unset | Comma-separated CORS origins. **Required for credentialed requests** — browsers reject wildcard CORS when credentials are sent. Unset = open, credential-free. |
| `ENABLE_SHAP` | `1` | Set `0` to skip loading the SHAP explainer (saves ~33 MB RSS; `/explain` then returns 503). |
| `PORT` | `8000` | Bind port (Render sets this automatically). |

---

## The 8 features

Order matters internally but **not** in your JSON payload — send them by name.

| Field | Unit | Valid range | Training median/mode |
|---|---|---|---|
| `serum_creatinine` | mg/dl | 0 < v ≤ 30 | 0.83 |
| `blood_urea_nitrogen` | mg/dl | 0 < v ≤ 200 | 14.0 |
| `bp_systolic` | mm/Hg | 60 < v ≤ 260 | 118.0 |
| `age` | years | 0 ≤ v ≤ 120 | 52.0 |
| `diabetes_diagnosed` | 0/1 | 0 or 1 | 0 |
| `albumin_serum` | g/dl | 0 < v ≤ 10 | 4.1 |
| `bmi` | kg/m² | 10 < v ≤ 100 | 27.7 |
| `ever_smoked` | 0/1 | 0 or 1 | 0 |

**All fields are optional.** Anything omitted is filled with the training median
(continuous) or mode (binary) — the same imputation the notebook used. The
response lists what was filled in `imputed_features`, so the UI can flag
estimated inputs. Supplying all 8 is strongly preferred for clinical accuracy.

---

## Endpoints

### `GET /health`

```json
{
  "status": "healthy",
  "model": "Stacking Ensemble (RF + GB + XGBoost -> LR)",
  "features": ["serum_creatinine", "...", "ever_smoked"],
  "threshold": 0.4439,
  "version": "1.1.0",
  "shap_enabled": true
}
```

Use this for the "API online" indicator. Render free instances cold-start, so
allow ~30–50 s on the first request after idling.

### `POST /predict`

Request:

```json
{
  "serum_creatinine": 3.5, "blood_urea_nitrogen": 45,
  "bp_systolic": 160, "age": 72, "diabetes_diagnosed": 1,
  "albumin_serum": 3.0, "bmi": 31, "ever_smoked": 1
}
```

Response (abridged):

```json
{
  "patient_features": { "serum_creatinine": 3.5, "...": 1 },
  "imputed_features": [],
  "kd_risk_score": 0.9627,
  "kd_risk_percentage": "96.3%",
  "predicted_class": "KD Risk",
  "predicted_class_int": 1,
  "probability_no_kd_risk": 0.0373,
  "probability_kd_risk": 0.9627,
  "risk_level": "Critical Risk",
  "urgency": "Urgent",
  "action": "Clinical profile highly consistent with kidney disease...",
  "threshold_used": 0.4439
}
```

#### Measured reference outputs

Actually produced by `nhanes_model_files/` — verified, not illustrative. Regenerate
with `python test_api.py`.

| Patient | Inputs (creat / BUN / SBP / age / DM / alb / BMI / smoke) | Risk | Band |
|---|---|---|---|
| Healthy young | 0.8 / 12 / 115 / 30 / 0 / 4.5 / 23 / 0 | 6.2% | Low Risk |
| Borderline | 0.87 / 19.6 / 150 / 38 / 1 / 3.2 / 30.8 / 0 | 46.3% | Moderate Risk |
| **All-normal, age 52** | 0.83 / 14 / 118 / 52 / 0 / 4.1 / 27.7 / 0 | **74.2%** | High Risk |
| Advanced CKD | 3.5 / 45 / 160 / 72 / 1 / 3.0 / 31 / 1 | 96.3% | Critical Risk |

The third row is the known defect — it should be single digits. See
[MODEL_VALIDATION.md](MODEL_VALIDATION.md).

### `POST /predict/batch`

Takes an array of up to 100 patient objects. Returns an array in the same order.
A row that fails validation yields `{ "index": n, "error": "...", "status": 422 }`
in that position instead of failing the whole batch.

### `POST /explain`

Same request body as `/predict`. Returns per-patient SHAP attributions:

```json
{
  "kd_risk_score": 0.9627,
  "predicted_class": "KD Risk",
  "base_value": 0.2871,
  "contributions": [
    {
      "feature": "serum_creatinine",
      "label": "Serum Creatinine",
      "value": 3.5,
      "shap_value": 0.272,
      "abs_contribution_pct": 55.2,
      "direction": "increases risk"
    }
  ],
  "top_drivers": ["Serum Creatinine", "Age", "Blood Urea Nitrogen"],
  "method": "SHAP TreeExplainer (Random Forest base learner)"
}
```

`contributions` is sorted by `abs_contribution_pct` descending — render it
directly as a horizontal bar chart. Positive `shap_value` pushes toward KD risk.

Returns **503** when the server was started with `ENABLE_SHAP=0`. Treat
explanations as optional in the UI.

> Attributions come from the Random Forest base learner, so they explain the
> ensemble's dominant signal rather than the calibrated probability exactly.
> Use them for direction and ranking, not as exact probability decomposition.

---

## Risk bands vs. the decision threshold

These are two **independent** axes, both taken verbatim from the training notebook:

| Probability | `risk_level` | `urgency` |
|---|---|---|
| 0.00 – 0.25 | Low Risk | Routine |
| 0.25 – 0.50 | Moderate Risk | Monitor |
| 0.50 – 0.75 | High Risk | Refer |
| 0.75 – 1.00 | Critical Risk | Urgent |

`predicted_class` flips at the **F1-optimal threshold of 0.4439**, not at a band
edge. So a score of 0.46 returns `predicted_class: "KD Risk"` alongside
`risk_level: "Moderate Risk"` / `urgency: "Monitor"`.

That is intentional and statistically correct, but it reads as contradictory if
both are given equal weight.

**How the UI resolves this:** `PredictionResult.tsx` leads with `risk_level` and
`urgency` as the clinical headline, and demotes `predicted_class` to a
"Screening result" tile that shows the threshold that produced it plus a note
explaining that clinical guidance follows the risk level. The PDF export
(`src/lib/pdf.ts`) uses the same hierarchy.

Verified against the borderline case
(`serum_creatinine: 0.87, bp_systolic: 150, age: 38, diabetes_diagnosed: 1,
albumin_serum: 3.2` → score `0.4628`), which renders as
**Moderate Risk / Monitor closely** with *Screening result: KD Risk* subordinate.

---

## Frontend integration

`src/lib/ckdService.ts` wraps every endpoint. Set the base URL:

```
NEXT_PUBLIC_CKD_API_URL=https://kidney-guard-api.onrender.com
```

```ts
import { predictRisk, explainRisk, formatResult } from '@/lib/ckdService';

const result = await predictRisk(features);
if (result.success) {
  const view = formatResult(result.data);   // colours, tier, percentages

  const shap = await explainRisk(features); // optional — may be 503
  if (shap.success) setDrivers(shap.data.contributions);
}
```

Both helpers return `ServiceResult<T>` (`{ success: true, data }` or
`{ success: false, error, status }`) and never throw.

`<PredictionResult response={result} features={submitted} />` renders the
assessment and, when `features` is supplied, the `<RiskDrivers />` SHAP chart
beneath it. Pass `features` from **state**, not a freshly built object — the
drivers component keys its fetch on that reference and would refetch on every
render otherwise.

If the server has SHAP disabled, `<RiskDrivers />` renders nothing rather than
showing an error, so the page degrades quietly.

---

## Deployment notes

**Render (API).** `render.yaml` is configured with a `/health` check.
Memory footprint: ~240 MB model + ~33 MB SHAP + framework ≈ **310 MB**, which
fits the 512 MB free tier. If the instance OOMs, set `ENABLE_SHAP=0` to recover
~33 MB at the cost of `/explain`.

**Model artifacts** live in `nhanes_model_files/` and are committed to git
(not ignored) so Render can build. `calibrated_model.pkl` is 69 MB — under
GitHub's 100 MB hard limit but above its 50 MB warning threshold. If the repo
gets unwieldy, move to Git LFS or fetch artifacts from object storage at boot.

**Version pinning is load-bearing.** The pickles were written with
scikit-learn 1.8.0 + numpy 2.x. Newer scikit-learn (e.g. 1.9.0) fails to
unpickle with `ModuleNotFoundError: No module named '_loss'`. `xgboost` must be
installed even though it is never imported directly — the pickled ensemble
references it.
