# Corrected Relabel + Retrain Cells

Drop-in replacements for `CKD_Risk_Prediction_NHANES 11.ipynb`. Variable names match
your notebook exactly, so downstream cells (EDA, SHAP, LIME, saving) keep working.

These fix **three** defects, not just the label:

| # | Defect | Where |
|---|---|---|
| 1 | `ckd_present` counts eGFR 60–89 without damage as CKD | Cell 6 → **Cell A** |
| 2 | Calibration fitted on SMOTE-resampled data, so probabilities target a balanced prior instead of the real one | Cells 30/39/45 → **Cells B, C, D** |
| 3 | Decision threshold selected on the **test set** — leakage that inflates reported metrics | Cell 47 → **Cell E** |

Defect 2 barely mattered at 43.2% prevalence. After the relabel it matters a lot:
true prevalence is 17.0%, so calibrating against a 50/50 prior inflates every
probability roughly 3–4×.

---

## Cell A — replaces the tail of Cell 6 (data loading)

Keep the `FILE_PATH` / `pd.read_csv` lines above it; replace from the "Drop missing
creatinine" step onward.

```python
# ── Drop patients with no creatinine (cannot compute eGFR) ───────
df_raw = df_raw.dropna(subset=['serum_creatinine'])
print(f'After dropping missing creatinine: {len(df_raw):,} patients')

# ── RELABEL: apply the KDIGO definition of CKD ───────────────────
# The shipped `ckd_present` marks every ckd_stage above "No CKD" as positive,
# which includes Stage 2 (eGFR 60-89). Under KDIGO, eGFR 60-89 (G2) is CKD ONLY
# with a damage marker (ACR >= 30). eGFR 60-89 and no albuminuria is normal and
# common with age. Of the 1,875 Stage 2 patients only 10.6% have ACR >= 30, so
# 1,676 labels -- 61% of all positives -- were wrong, and the target became
# largely a proxy for age.
old_labels = df_raw[TARGET].copy()

# ACR missing and eGFR >= 60 -> cannot confirm or exclude damage. Dropping is
# honest; assuming "no albuminuria" would silently invent negatives.
# (~101 patients. To keep them instead, delete these two lines -- prevalence
# lands at 16.7% rather than 17.0%.)
undetermined = df_raw['albumin_creatinine_ratio'].isna() & (df_raw['egfr'] >= 60)
df_raw = df_raw[~undetermined].copy()

df_raw[TARGET] = (
    (df_raw['egfr'] < 60) | (df_raw['albumin_creatinine_ratio'] >= 30)
).astype(int)

print(f'\nRELABEL (KDIGO: eGFR < 60 OR ACR >= 30)')
print(f'  Dropped (ACR undetermined) : {int(undetermined.sum()):,}')
print(f'  Prevalence before          : {old_labels.mean()*100:.1f}%')
print(f'  Prevalence after           : {df_raw[TARGET].mean()*100:.1f}%')
print(f'  Imbalance                  : '
      f'{(1-df_raw[TARGET].mean())/df_raw[TARGET].mean():.2f}:1')

df = df_raw[FEATURES_8 + [TARGET]].copy()
print(f'\nDataset shape: {df.shape}')
```

Expected: `43.2% -> 17.0%`, imbalance `4.88:1`.

> `egfr` and `albumin_creatinine_ratio` stay in `LEAKAGE` and are still excluded
> from `FEATURES_8`. They are used **only** to construct the label, which is
> correct — the model must predict CKD status without being handed eGFR.

---

## Cell B — replaces Cell 30 (train/test split)

Adds a calibration set carved from training data. The test set stays untouched.

```python
X = df[FEATURES_8].copy()
y = df[TARGET].copy()

# Test set: never used for fitting, calibration or threshold selection.
X_train_full, X_test, y_train_full, y_test = train_test_split(
    X, y, test_size=0.20, random_state=42, stratify=y)

# Split training data into a fitting set and a calibration set. Calibration MUST
# see the real class distribution, so this set is never SMOTE-resampled.
X_fit, X_calib, y_fit, y_calib = train_test_split(
    X_train_full, y_train_full, test_size=0.25, random_state=42,
    stratify=y_train_full)

print(f'Fitting set     : {X_fit.shape}  ({y_fit.mean()*100:.1f}% positive)')
print(f'Calibration set : {X_calib.shape}  ({y_calib.mean()*100:.1f}% positive)')
print(f'Test set        : {X_test.shape}  ({y_test.mean()*100:.1f}% positive)')

# Kept so any downstream cell referencing X_train still resolves.
X_train, y_train = X_fit, y_fit
```

## Cell C — replaces Cells 32 / 37 / 39 (impute, scale, SMOTE)

```python
num_feats = ['serum_creatinine','blood_urea_nitrogen',
             'bp_systolic','age','albumin_serum','bmi']
bin_feats = ['diabetes_diagnosed','ever_smoked']

# Imputation values come from the FITTING set only.
train_medians = X_fit[num_feats].median()
train_modes   = X_fit[bin_feats].mode().iloc[0]

def apply_imputation(frame):
    frame = frame.copy()
    for f in num_feats: frame[f] = frame[f].fillna(train_medians[f])
    for f in bin_feats: frame[f] = frame[f].fillna(train_modes[f])
    return frame

X_fit   = apply_imputation(X_fit)
X_calib = apply_imputation(X_calib)
X_test  = apply_imputation(X_test)
X_train = X_fit

scaler         = StandardScaler().fit(X_fit)
X_fit_scaled   = scaler.transform(X_fit)
X_calib_scaled = scaler.transform(X_calib)
X_test_scaled  = scaler.transform(X_test)
X_train_scaled = X_fit_scaled

# Resample ONLY the fitting set. sampling_strategy=0.7 rather than full 1.0:
# at 4.88:1 imbalance, balancing completely would synthesise ~4x the real
# minority count and the model would largely be learning interpolated points.
smotenc = SMOTENC(categorical_features=BINARY_INDICES,
                  sampling_strategy=0.7, random_state=42)
X_train_sm, y_train_sm = smotenc.fit_resample(X_fit_scaled, y_fit)

print(f'Before SMOTENC : {np.bincount(y_fit)}')
print(f'After  SMOTENC : {np.bincount(y_train_sm)}')
print(f'Calibration set left un-resampled: {np.bincount(y_calib)}')
```

> Base-learner tuning (Cell 41) and the stacking ensemble (Cell 43) need **no
> changes** — they already fit on `X_train_sm` / `y_train_sm`. One change worth
> making: switch `scoring='f1_macro'` to `scoring='average_precision'` in all
> three `RandomizedSearchCV` calls. PR-AUC is the right target for a 17%-prevalence
> problem.

## Cell D — replaces Cell 45 (calibration)

```python
from sklearn.frozen import FrozenEstimator

# Calibrate the ALREADY-FITTED ensemble against real, un-resampled data.
# The previous version called .fit(X_train_sm, y_train_sm), which calibrated to
# a synthetic balanced prior instead of the true 17% prevalence.
results = {}
for method in ('sigmoid', 'isotonic'):
    model = CalibratedClassifierCV(FrozenEstimator(stacking_model), method=method)
    model.fit(X_calib_scaled, y_calib)
    prob = model.predict_proba(X_calib_scaled)[:, 1]
    results[method] = (model, brier_score_loss(y_calib, prob))
    print(f'  {method:<9}: Brier {results[method][1]:.4f}')

# Prefer sigmoid unless isotonic is clearly better. Isotonic is a step function
# and with only ~1,200 calibration rows it produces visibly quantised
# probabilities (risk plateaus across wide clinical ranges).
sig_brier, iso_brier = results['sigmoid'][1], results['isotonic'][1]
cal_method = 'isotonic' if iso_brier < sig_brier - 0.005 else 'sigmoid'
calibrated_model = results[cal_method][0]
print(f'\nSelected: {cal_method}')

best_probs = calibrated_model.predict_proba(X_test_scaled)
```

## Cell E — replaces Cell 47 (threshold)

```python
# Threshold is chosen on the CALIBRATION set. The previous version selected it
# on y_test, which leaks the test set into a fitted parameter and inflates every
# metric reported afterwards.
calib_probs = calibrated_model.predict_proba(X_calib_scaled)[:, 1]
precisions, recalls, thresholds = precision_recall_curve(y_calib, calib_probs)

f1_scores = [2*p*r/(p+r) if (p+r) > 0 else 0.0
             for p, r in zip(precisions[:-1], recalls[:-1])]
optimal_threshold = float(thresholds[int(np.argmax(f1_scores))])
print(f'Optimal threshold (from calibration set): {optimal_threshold:.4f}')

# For a screening tool, favouring recall is defensible. Uncomment to pick the
# lowest threshold reaching 80% recall instead of the F1 optimum:
# target_recall = 0.80
# ok = [(t, r) for t, r in zip(thresholds, recalls[:-1]) if r >= target_recall]
# optimal_threshold = float(max(t for t, _ in ok))
# print(f'Recall-oriented threshold: {optimal_threshold:.4f}')

y_prob_ckd = np.clip(best_probs[:, 1], 0.001, 0.999)
y_pred     = (y_prob_ckd >= optimal_threshold).astype(int)
```

## Cell F — NEW, add before the save cell

Gate saving on clinical plausibility, so a bad model cannot be exported silently.

```python
def clinical_risk(**overrides):
    patient = dict(serum_creatinine=0.83, blood_urea_nitrogen=14.0,
                   bp_systolic=118.0, age=52.0, diabetes_diagnosed=0,
                   albumin_serum=4.1, bmi=27.7, ever_smoked=0)
    patient.update(overrides)
    row = np.array([[patient[f] for f in FEATURES_8]], dtype=float)
    return float(calibrated_model.predict_proba(scaler.transform(row))[0, 1])

print('CLINICAL PLAUSIBILITY')
checks = []

normal_52 = clinical_risk()
ok = normal_52 < 0.25
checks.append(ok)
print(f'  All-normal 52yo      : {normal_52*100:5.1f}%   '
      f'(previous model: 74.2%)  {"PASS" if ok else "FAIL"}')

severe = clinical_risk(serum_creatinine=3.5, blood_urea_nitrogen=45,
                       bp_systolic=160, age=72, diabetes_diagnosed=1,
                       albumin_serum=3.0, bmi=31, ever_smoked=1)
ok = severe > 0.50
checks.append(ok)
print(f'  Advanced CKD profile : {severe*100:5.1f}%   {"PASS" if ok else "FAIL"}')

series = [(v, clinical_risk(serum_creatinine=v))
          for v in (0.7, 0.83, 1.0, 1.2, 1.5, 2.0, 3.0)]
drops = [(a[0], b[0]) for a, b in zip(series, series[1:]) if b[1] < a[1] - 0.005]
checks.append(not drops)
print(f'  Creatinine response  : '
      + '  '.join(f'{v}:{s*100:.0f}%' for v, s in series))
print(f'                         {"monotonic - PASS" if not drops else f"INVERTED at {drops} - FAIL"}')

print('  Age response         : '
      + '  '.join(f'{a}:{clinical_risk(age=a)*100:.0f}%'
                  for a in (30, 40, 50, 52, 60, 70, 80)))

if all(checks):
    print('\nAll checks passed - safe to save artifacts.')
else:
    raise RuntimeError('Clinical plausibility failed - do NOT save or deploy.')
```

The save cell then runs unchanged. **Also re-fit the SHAP explainer** — the existing
`shap_explainer.pkl` belongs to the old model:

```python
rf_explainer = shap.TreeExplainer(best_rf)
```

---

## Verified results

Ran end-to-end on `CKD_NHANES_2021_2023.csv` with a reduced search
(`n_iter=4, cv=3` — for speed only; use your original `n_iter=20, cv=5`):

```
relabel: 6326 -> 6225 rows; prevalence 43.2% -> 17.0%
fit=3735  calib=1245  test=1245
SMOTE: [3100 635] -> [3100 2170]

TEST (real distribution)
  ROC-AUC 0.8279   PR-AUC 0.6449   Brier 0.0959
  accuracy 0.8209  precision 0.4806  recall 0.6415  specificity 0.8577

CLINICAL SANITY
  all-normal 52yo : 5.9%   (was 74.2%)   PASS
  severe CKD      : 86.4%                PASS
```

**The headline defect is fixed: 74.2% → ~6%**, which is finally consistent with the
8.1% true-KDIGO rate for that patient profile, and with the 9.8% the original
`README_API.md` claimed.

## Be ready to defend the lower numbers

**ROC-AUC drops 0.9225 → ~0.83, and precision is ~0.48.** That is expected and is
the honest result. The old 0.92 was measured against a target that was substantially
"is this person over 50", which is trivially predictable from age — and the old
threshold was tuned on the test set, inflating it further. The new numbers describe
a genuinely harder problem: 17% prevalence instead of 43%.

Frame it as: *"the previous model scored higher against an incorrect label; correcting
the label to the KDIGO standard reduces apparent performance but makes the output
clinically valid."* That is a much stronger position than defending 99% accuracy on
a broken target.

At ~0.48 precision roughly half of flagged patients are false positives. For a
screening tool that routes to a confirmatory eGFR/ACR test this is usually
acceptable — but state it explicitly rather than letting a panel find it.

**Expect some residual coarseness.** In the reduced-search run, creatinine still
plateaus above ~1.5 and age response is fairly flat. The full search should improve
resolution. If age still looks flat afterwards, that is genuinely informative: once
the age-proxy label is removed, age carries much less independent signal than the
old model implied.

## After retraining

1. Copy the six new `.pkl` files into `nhanes_model_files/`.
2. Update `threshold.pkl` — `0.4439` will not survive the prevalence change
   (the trial run produced ~0.18–0.29).
3. Run `python test_api.py`; section 9 should report no `[WARN]` lines.
4. Update the measured-outputs table in `API_DOCUMENTATION.md` and mark
   `MODEL_VALIDATION.md` resolved.
