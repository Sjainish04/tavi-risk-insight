"""Decision-curve analysis + fairness audit on the synthetic test cohort.

Uses MSKCC's `dcurves` for population-level Net Benefit and Microsoft's `fairlearn`
for sex/age fairness across our 4 model variants. Saves an artifact for the
frontend Model Card.

Run: cd api && uv run python scripts/dca_and_fairness.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from dcurves import dca
from fairlearn.metrics import (
    MetricFrame,
    equalized_odds_difference,
    false_negative_rate,
    false_positive_rate,
)
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import train_test_split

_REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO / "src"))

from tavi_api.data.synthetic import (  # noqa: E402
    FEATURE_COLUMNS,
    OUTCOME_COLUMN,
    generate_synthetic_cohort,
)

SEED = 42
ARTIFACT_PATH = _REPO / "artifacts" / "dca_fairness.json"
DCA_THRESHOLDS = np.arange(0.005, 0.21, 0.005)


def main() -> None:
    cohort = generate_synthetic_cohort(n=5000, seed=SEED)
    brdav_df = pd.read_parquet(_REPO / "artifacts" / "brdav_cohort.parquet").set_index("patient_idx")["brdav_followup"]
    cohort["brdav_followup"] = cohort.index.map(brdav_df)

    feats_v1 = list(FEATURE_COLUMNS)
    feats_v2 = feats_v1 + ["brdav_followup"]
    X_v1 = cohort[feats_v1].astype(float).values
    X_v2 = cohort[feats_v2].astype(float).values
    y = cohort[OUTCOME_COLUMN].values

    indices = np.arange(len(y))
    idx_train, idx_test = train_test_split(indices, test_size=0.20, random_state=SEED, stratify=y)
    X_v1_test, X_v2_test = X_v1[idx_test], X_v2[idx_test]
    y_test = y[idx_test]

    test_meta = cohort.iloc[idx_test].reset_index(drop=True)
    sex_test = test_meta["sex_female"].map({True: "female", False: "male"}).values
    # Age tertiles
    age_q = pd.qcut(test_meta["age_years"], q=3, labels=["age_lo", "age_mid", "age_hi"])
    age_group = age_q.astype(str).values

    # ---------- Predict with each variant on test set ----------
    models = _REPO / "models"
    print("Loading saved models …")
    v1 = joblib.load(models / "calibrator.pkl")
    v2 = joblib.load(models / "calibrator_v2_lgbm_brdav.pkl")
    v3 = joblib.load(models / "calibrator_v3_stacking_brdav.pkl")

    preds = {
        "v1_lgbm_baseline": v1.predict_proba(X_v1_test)[:, 1],
        "v2_lgbm_brdav": v2.predict_proba(X_v2_test)[:, 1],
        "v3_stacking": v3.predict_proba(X_v2_test)[:, 1],
    }

    # ---------- Decision Curve Analysis (proper, population-level) ----------
    print("Computing decision curves …")
    dca_data: dict[str, list[dict]] = {}
    for name, p in preds.items():
        df = pd.DataFrame({"outcome": y_test, "model": p})
        result = dca(
            data=df,
            outcome="outcome",
            modelnames=["model"],
            thresholds=DCA_THRESHOLDS.tolist(),
        )
        # dcurves returns long-form dataframe with columns: model, threshold, net_benefit, ...
        rows = []
        for _, row in result.iterrows():
            rows.append({
                "threshold": float(row["threshold"]),
                "label": str(row["model"]),
                "net_benefit": float(row["net_benefit"]) if pd.notna(row["net_benefit"]) else None,
            })
        dca_data[name] = rows

    # ---------- Fairness audit (sex × age tertile) ----------
    print("Computing fairness metrics …")
    # Use top-decile threshold for "high risk" classification
    fairness_data: dict[str, dict] = {}
    for name, p in preds.items():
        thr = float(np.quantile(p, 0.90))
        y_hat = (p >= thr).astype(int)

        # By sex
        mf_sex = MetricFrame(
            metrics={
                "auroc": lambda yt, yp: roc_auc_score(yt, yp) if len(np.unique(yt)) > 1 else float("nan"),
                "fnr": false_negative_rate,
                "fpr": false_positive_rate,
                "selection_rate": lambda yt, yp: float(yp.mean()),
                "n": lambda yt, yp: int(len(yt)),
                "outcome_rate": lambda yt, yp: float(yt.mean()),
            },
            y_true=y_test,
            y_pred=y_hat,
            sensitive_features=sex_test,
        )
        # The auroc metric needs y_score, not y_pred — recompute with raw probabilities
        sex_groups = sorted(np.unique(sex_test).tolist())
        per_sex = {}
        for g in sex_groups:
            mask = sex_test == g
            per_sex[g] = {
                "n": int(mask.sum()),
                "outcome_rate": float(y_test[mask].mean()),
                "selection_rate": float(y_hat[mask].mean()),
                "auroc": float(roc_auc_score(y_test[mask], p[mask])) if len(np.unique(y_test[mask])) > 1 else None,
                "fnr": float(mf_sex.by_group["fnr"][g]),
                "fpr": float(mf_sex.by_group["fpr"][g]),
            }
        eod_sex = float(equalized_odds_difference(y_test, y_hat, sensitive_features=sex_test))

        # By age tertile
        per_age = {}
        for g in ["age_lo", "age_mid", "age_hi"]:
            mask = age_group == g
            if mask.sum() == 0:
                continue
            per_age[g] = {
                "n": int(mask.sum()),
                "outcome_rate": float(y_test[mask].mean()),
                "selection_rate": float(y_hat[mask].mean()),
                "auroc": float(roc_auc_score(y_test[mask], p[mask])) if len(np.unique(y_test[mask])) > 1 else None,
            }

        fairness_data[name] = {
            "threshold_used": thr,
            "by_sex": per_sex,
            "by_age": per_age,
            "equalized_odds_difference_sex": eod_sex,
        }

    artifact = {
        "n_test": int(len(y_test)),
        "outcome_30d_rate": float(y_test.mean()),
        "decision_curve_analysis": dca_data,
        "fairness": fairness_data,
        "thresholds": [float(t) for t in DCA_THRESHOLDS],
    }
    ARTIFACT_PATH.write_text(json.dumps(artifact, indent=2))
    print(f"Saved -> {ARTIFACT_PATH}")
    print()
    print("Summary — equalized-odds difference by sex (closer to 0 = fairer):")
    for name, f in fairness_data.items():
        print(f"  {name:<22}  EOD_sex = {f['equalized_odds_difference_sex']:.3f}  "
              f"sex_aurocs: female={f['by_sex'].get('female', {}).get('auroc')} male={f['by_sex'].get('male', {}).get('auroc')}")


if __name__ == "__main__":
    main()
