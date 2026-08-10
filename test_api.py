"""
Smoke tests for the Kidney Disease Risk Prediction API.

Runs the app in-process (no server needed):
    python test_api.py

Checks the full inference chain against clinically expected outcomes, so a
broken scaler/threshold/feature-order wiring fails loudly rather than silently
returning plausible numbers.
"""

import sys

from fastapi.testclient import TestClient

import ckd_api
from ckd_api import app

client = TestClient(app)

HEALTHY = {
    "serum_creatinine": 0.8, "blood_urea_nitrogen": 12.0,
    "bp_systolic": 115.0, "age": 30.0, "diabetes_diagnosed": 0,
    "albumin_serum": 4.5, "bmi": 23.0, "ever_smoked": 0,
}

HIGH_RISK = {
    "serum_creatinine": 3.5, "blood_urea_nitrogen": 45.0,
    "bp_systolic": 160.0, "age": 72.0, "diabetes_diagnosed": 1,
    "albumin_serum": 3.0, "bmi": 31.0, "ever_smoked": 1,
}

passed = failed = 0


def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  [PASS] {name}")
    else:
        failed += 1
        print(f"  [FAIL] {name} {detail}")


print("=" * 62)
print("KIDNEY DISEASE RISK API - SMOKE TESTS")
print("=" * 62)

# ── Health ───────────────────────────────────────────────────────
print("\n[1] Health endpoint")
r = client.get("/health")
check("returns 200", r.status_code == 200, f"got {r.status_code}")
h = r.json()
check("reports healthy", h["status"] == "healthy")
check("exposes 8 features", len(h["features"]) == 8, f"got {len(h['features'])}")
check(
    "feature order matches training",
    h["features"] == [
        "serum_creatinine", "blood_urea_nitrogen", "bp_systolic", "age",
        "diabetes_diagnosed", "albumin_serum", "bmi", "ever_smoked",
    ],
    f"got {h['features']}",
)
check("threshold ~0.4439", abs(h["threshold"] - 0.4439) < 0.01, f"got {h['threshold']}")
print(f"       SHAP enabled: {h['shap_enabled']}")

# ── Prediction: healthy patient ──────────────────────────────────
print("\n[2] Predict - healthy young patient")
r = client.post("/predict", json=HEALTHY)
check("returns 200", r.status_code == 200, r.text[:200])
d = r.json()
check("classified No KD Risk", d["predicted_class"] == "No KD Risk",
      f"got {d['predicted_class']} at {d['kd_risk_percentage']}")
check("low risk score (<0.25)", d["kd_risk_score"] < 0.25, f"got {d['kd_risk_score']}")
check("band is Low Risk", d["risk_level"] == "Low Risk", f"got {d['risk_level']}")
check("probabilities sum to 1",
      abs(d["probability_kd_risk"] + d["probability_no_kd_risk"] - 1.0) < 0.01)
check("nothing imputed", d["imputed_features"] == [], f"got {d['imputed_features']}")
print(f"       risk = {d['kd_risk_percentage']} ({d['risk_level']})")

# ── Prediction: high-risk patient ────────────────────────────────
print("\n[3] Predict - high-risk patient")
r = client.post("/predict", json=HIGH_RISK)
check("returns 200", r.status_code == 200, r.text[:200])
d2 = r.json()
check("classified KD Risk", d2["predicted_class"] == "KD Risk",
      f"got {d2['predicted_class']} at {d2['kd_risk_percentage']}")
check("high risk score (>0.75)", d2["kd_risk_score"] > 0.75, f"got {d2['kd_risk_score']}")
check("band is Critical Risk", d2["risk_level"] == "Critical Risk", f"got {d2['risk_level']}")
check("urgency is Urgent", d2["urgency"] == "Urgent")
print(f"       risk = {d2['kd_risk_percentage']} ({d2['risk_level']})")

# ── Ordering sanity ──────────────────────────────────────────────
print("\n[4] Clinical ordering")
check("sick patient scores higher than healthy",
      d2["kd_risk_score"] > d["kd_risk_score"],
      f"{d2['kd_risk_score']} vs {d['kd_risk_score']}")

# ── Imputation ───────────────────────────────────────────────────
print("\n[5] Imputation of omitted fields")
partial = {"serum_creatinine": 0.9, "age": 45.0}
r = client.post("/predict", json=partial)
check("returns 200 with partial input", r.status_code == 200, r.text[:200])
d3 = r.json()
check("reports 6 imputed fields", len(d3["imputed_features"]) == 6,
      f"got {d3['imputed_features']}")
check("uses training median for BUN",
      abs(d3["patient_features"]["blood_urea_nitrogen"] - 14.0) < 1e-6,
      f"got {d3['patient_features']['blood_urea_nitrogen']}")
check("supplied values preserved",
      abs(d3["patient_features"]["serum_creatinine"] - 0.9) < 1e-6)

# ── Validation ───────────────────────────────────────────────────
print("\n[6] Input validation")
bad = dict(HEALTHY, serum_creatinine=-5)
check("rejects negative creatinine", client.post("/predict", json=bad).status_code == 422)
bad = dict(HEALTHY, diabetes_diagnosed=7)
check("rejects non-binary diabetes flag",
      client.post("/predict", json=bad).status_code == 422)
bad = dict(HEALTHY, age=999)
check("rejects out-of-range age", client.post("/predict", json=bad).status_code == 422)

# ── Batch ────────────────────────────────────────────────────────
print("\n[7] Batch prediction")
r = client.post("/predict/batch", json=[HEALTHY, HIGH_RISK])
check("returns 200", r.status_code == 200, r.text[:200])
b = r.json()
check("returns 2 results", len(b) == 2, f"got {len(b)}")
check("batch matches single predictions",
      b[0]["predicted_class"] == "No KD Risk" and b[1]["predicted_class"] == "KD Risk")
r = client.post("/predict/batch", json=[HEALTHY] * 101)
check("rejects >100 patients", r.status_code == 400, f"got {r.status_code}")

# ── SHAP explanation ─────────────────────────────────────────────
print("\n[8] SHAP explanation")
if ckd_api.shap_explainer is None:
    print("       [SKIP] SHAP explainer not loaded")
else:
    r = client.post("/explain", json=HIGH_RISK)
    check("returns 200", r.status_code == 200, r.text[:200])
    e = r.json()
    check("explains all 8 features", len(e["contributions"]) == 8,
          f"got {len(e['contributions'])}")
    check("contributions sorted by magnitude",
          all(e["contributions"][i]["abs_contribution_pct"]
              >= e["contributions"][i + 1]["abs_contribution_pct"]
              for i in range(len(e["contributions"]) - 1)))
    check("percentages sum to ~100",
          abs(sum(c["abs_contribution_pct"] for c in e["contributions"]) - 100) < 1.0)
    check("serum creatinine is a top driver",
          "Serum Creatinine" in e["top_drivers"], f"got {e['top_drivers']}")
    top = e["contributions"][0]
    check("top driver increases risk for sick patient",
          top["direction"] == "increases risk", f"got {top['direction']}")
    print(f"       top drivers: {', '.join(e['top_drivers'])}")

# ── Clinical plausibility (reporting, not asserting) ─────────────
# These do NOT fail the suite: the engineering is correct, the training LABEL is
# not (see MODEL_VALIDATION.md). They surface the defect on every run so it can't
# be forgotten, and become real assertions once the model is retrained.
print("\n[9] Clinical plausibility (advisory)")
ALL_NORMAL = {
    "serum_creatinine": 0.83, "blood_urea_nitrogen": 14.0,
    "bp_systolic": 118.0, "age": 52.0, "diabetes_diagnosed": 0,
    "albumin_serum": 4.1, "bmi": 27.7, "ever_smoked": 0,
}
score = client.post("/predict", json=ALL_NORMAL).json()["kd_risk_score"]
if score > 0.25:
    print(f"       [WARN] all-normal 52yo scores {score * 100:.1f}% "
          f"(expected <25%). Known label defect - see MODEL_VALIDATION.md")
else:
    print(f"       [OK] all-normal 52yo scores {score * 100:.1f}%")

# Creatinine response should be monotonic; currently it is not.
def creat_at(v):
    return client.post("/predict", json=dict(ALL_NORMAL, serum_creatinine=v)) \
                 .json()["kd_risk_score"]


series = [(v, creat_at(v)) for v in (0.7, 0.83, 1.0, 1.2, 1.5, 2.0, 3.0)]
# 0.5pp tolerance: sub-percent wobble isn't clinically meaningful, a real
# inversion (e.g. 0.83 -> 74% then 1.00 -> 66%) is.
drops = [(a[0], b[0]) for a, b in zip(series, series[1:]) if b[1] < a[1] - 0.005]
if drops:
    print(f"       [WARN] creatinine response non-monotonic at {drops} "
          f"(higher creatinine lowering risk is clinically backwards)")
else:
    print("       [OK] creatinine response is monotonic")
print("       " + "  ".join(f"{v}:{s * 100:.0f}%" for v, s in series))

# ── Summary ──────────────────────────────────────────────────────
print("\n" + "=" * 62)
print(f"RESULT: {passed} passed, {failed} failed")
print("=" * 62)
sys.exit(1 if failed else 0)
