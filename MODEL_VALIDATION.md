# Model Validation Findings

**Status: the deployed-candidate model is NOT cleared for production.**
Investigated 2026-08-10 against `CKD_NHANES_2021_2023.csv` (11,933 rows; 6,326
after dropping missing `serum_creatinine`) and every model artifact produced that day.

---

## Summary

The model is not defective in its engineering. It faithfully learned a **mislabelled
target**. `ckd_present` classifies **eGFR 60–89 without kidney damage as CKD**, which
KDIGO does not. That single labelling error inflates prevalence from 16.7% to 43.2%
and makes the target largely a proxy for *age*, which is what produces the erratic
predictions.

---

## 1. The documented example is not reproducible

`README_API.md` (shipped with the model artifacts) documents this request:

```json
{"serum_creatinine": 0.83, "blood_urea_nitrogen": 14.0, "bp_systolic": 118.0,
 "age": 52.0, "diabetes_diagnosed": 0, "albumin_serum": 4.1, "bmi": 27.7,
 "ever_smoked": 0}
```

…returning **9.8% / Low Risk**. Every model artifact returns **74.2% / High Risk**:

| `calibrated_model.pkl` version | Result |
|---|---|
| 04:11, 10:12, 10:19, 12:13, 13:00, repo copy | **74.2%** (all six) |

The six models are functionally identical — maximum pairwise prediction difference
across 200 random patients is **2.2e-16**. Swapping `.pkl` files cannot change this.
The reference `app.py` shipped with the model uses the same inference chain as
`ckd_api.py`, so this is not a preprocessing difference either.

**The README's example output was never produced by any of these models.**

## 2. Single-feature response is non-monotonic and discontinuous

Holding all other inputs at the population median:

**Serum creatinine** (age 52)

| mg/dl | 0.50 | 0.60 | 0.70 | **0.83** | 1.00 | 1.20 | 1.50 | 2.00 | 3.00 |
|---|---|---|---|---|---|---|---|---|---|
| risk | 11.5% | 9.6% | 9.1% | **74.2%** | **66.2%** | 96.2% | 96.2% | 96.2% | 96.2% |

- 1.00 mg/dl scores **lower** than 0.83 — clinically backwards.
- Everything ≥1.2 saturates at 96.2%: the model cannot distinguish mild from severe.

**Age** (normal labs)

| yrs | 40 | 45 | **50** | **52** | 55 | 60 | 65 | 70 | 80 |
|---|---|---|---|---|---|---|---|---|---|
| risk | 8.2% | 13.4% | **46.3%** | **74.2%** | 81.4% | 71.4% | 78.3% | 70.4% | 95.0% |

A near-vertical cliff between 45 and 52, then non-monotonic wobble.

Imputation leakage is **ruled out**: `serum_creatinine` and `age` had **zero**
missing values in training (per the notebook, only `bp_systolic` 156,
`bmi` 60, `ever_smoked` 538, `diabetes_diagnosed` 165, `blood_urea_nitrogen` 1
were imputed).

## 3. Root cause — the label

`ckd_present` is derived from `ckd_stage`, and **every** stage above "No CKD" is
counted positive:

| `ckd_stage` | eGFR range | n | `ckd_present` |
|---|---|---|---|
| No CKD | 90.0 – 178.4 | 3592 | 0 |
| Stage 1 (Kidney Damage) | 90.0 – 153.8 | 382 | 1 |
| **Stage 2 (Mildly Decreased)** | **60.0 – 90.0** | **1875** | **1** |
| Stage 3a | 45.1 – 60.0 | 341 | 1 |
| Stage 3b | 30.5 – 45.0 | 97 | 1 |
| Stage 4 | 16.2 – 29.7 | 28 | 1 |
| Stage 5 | 3.5 – 13.4 | 11 | 1 |

Under **KDIGO**, eGFR 60–89 (G2) is CKD *only if* a damage marker is present
(e.g. ACR ≥ 30). eGFR 60–89 with no albuminuria is normal, and common with age.

- Stage 1 is defined **correctly** — 100% of its 382 patients have ACR ≥ 30.
- Stage 2 is **not** — only **10.6%** of its 1,875 patients have ACR ≥ 30.
  The other **87.7% (1,676 patients) are labelled CKD-positive but are not CKD.**

That is **61% of all positive labels in the dataset.**

| Definition | Prevalence |
|---|---|
| `ckd_present` as built | **43.2%** (2734/6326) |
| Proper KDIGO (`eGFR < 60` OR `ACR ≥ 30`) | **16.7%** (1058/6326) |

## 4. Why this produces exactly the observed symptoms

eGFR is computed from creatinine and age (CKD-EPI 2021). At normal creatinine,
crossing below eGFR 90 is driven almost entirely by **age**. So `ckd_present`
becomes approximately *"is this person over ~50 with average creatinine"*.

The Stage 2 group's median age is **65** and median creatinine **0.95** — normal.

Label rate vs age, restricted to normal creatinine (0.75–0.95 mg/dl):

| Age band | n | `ckd_present` | True KDIGO |
|---|---|---|---|
| 20–35 | 423 | 9.2% | 3.1% |
| 35–45 | 340 | 17.9% | 4.1% |
| 45–50 | 140 | 23.6% | 3.6% |
| **50–55** | 176 | **46.0%** | 6.8% |
| 55–60 | 250 | 50.4% | 8.0% |
| 60–70 | 591 | 65.5% | 10.7% |
| 70–90 | 409 | 84.4% | 17.4% |

**The age cliff is in the label, not the model.** The true KDIGO rate is nearly
flat (3–17%) — what a clinician would expect.

For patients matching the README example (creatinine 0.75–0.95, age 48–56, n=246):

- labelled CKD-positive: **41.9%**
- truly CKD by KDIGO: **8.1%**  ← essentially the README's claimed 9.8%
- model predicts: **74.2%**

The README's expected value appears to have been derived from the *correct*
clinical definition, while the model was trained on the incorrect one.

## 5. What is NOT wrong

- **Engineering.** Feature order, scaler, threshold, imputation and the inference
  chain in `ckd_api.py` all match the training notebook and the reference `app.py`.
- **Aggregate metrics** on the real held-out test set are strong *for the label as
  defined*: ROC-AUC 0.9225, accuracy 87.0%, Brier 0.1034, specificity 0.886.
  The model ranks patients well — against a target that is partly "age".
- **SHAP.** `shap_explainer.pkl` wraps the notebook's standalone `best_rf`
  (fit on all of `X_train_sm`), while `CalibratedClassifierCV(cv=5)` refits a clone
  per fold. Additivity differs from each fold's RF by 0.057–0.094, so attributions
  give valid **direction and ranking** but are not an exact decomposition of the
  calibrated probability. This is by design, not a defect.

## 6. Recommended fix

Relabel and retrain:

```python
ckd_present = ((egfr < 60) | (albumin_creatinine_ratio >= 30)).astype(int)
```

Then re-derive the threshold — prevalence drops from 43.2% to 16.7%, so the
F1-optimal threshold will move and `0.4439` will no longer apply. Expect lower
headline accuracy (a 16.7%-prevalence problem is harder than a 43.2% one) but
clinically defensible behaviour: monotonic response to creatinine, and no cliff at
age 50.

Re-validate against the documented example before deploying: a 52-year-old with
entirely normal labs should land in the single digits, not at 74%.

## 7. Reproducing this analysis

Requires `scikit-learn==1.8.0`, `numpy` 2.x, `xgboost`, `shap` (newer scikit-learn
fails to unpickle with `ModuleNotFoundError: No module named '_loss'`).

```bash
python test_api.py
```

The sweeps in §2 and the label analysis in §3–4 were run directly against
`nhanes_model_files/` and `CKD_NHANES_2021_2023.csv`.
