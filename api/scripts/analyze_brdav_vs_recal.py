"""Analyze brdav follow-up-mortality vs our 30-d models on the synthetic cohort.

Computes:
- Spearman rank correlation (endpoint-invariant, the honest comparison)
- Per-decile mean brdav by our recalibrated STS-PROM decile
- Decile-binned subgroup statistics
- Cohen's kappa for top-decile flagging agreement
- O/E ratio per model on the synthetic outcomes (raw STS, recal STS, LGBM)

Saves a small JSON artifact for the frontend Model Card.

Run:
    cd api && uv run python scripts/analyze_brdav_vs_recal.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats
from sklearn.metrics import cohen_kappa_score

_REPO = Path(__file__).resolve().parent.parent
INPUT_PATH = _REPO / "artifacts" / "brdav_cohort.parquet"
OUTPUT_PATH = _REPO / "artifacts" / "brdav_vs_recal.json"


def main() -> None:
    df = pd.read_parquet(INPUT_PATH)
    print(f"Loaded {len(df)} rows from {INPUT_PATH.name}")

    # ---------- Rank correlations (endpoint-invariant) ----------
    rho_brdav_recal, _ = stats.spearmanr(df["brdav_followup"], df["sts_recal"])
    rho_brdav_raw, _ = stats.spearmanr(df["brdav_followup"], df["sts_raw"])
    rho_brdav_lgbm, _ = stats.spearmanr(df["brdav_followup"], df["lgbm_30d"])
    rho_recal_lgbm, _ = stats.spearmanr(df["sts_recal"], df["lgbm_30d"])

    print()
    print("Spearman rank correlation (endpoint-invariant):")
    print(f"  brdav vs sts_recal: ρ = {rho_brdav_recal:.3f}")
    print(f"  brdav vs sts_raw:   ρ = {rho_brdav_raw:.3f}")
    print(f"  brdav vs lgbm_30d:  ρ = {rho_brdav_lgbm:.3f}")
    print(f"  sts_recal vs lgbm:  ρ = {rho_recal_lgbm:.3f}")

    # ---------- Per-decile of sts_recal: mean brdav ----------
    df["recal_decile"] = pd.qcut(df["sts_recal"], q=10, labels=False, duplicates="drop")
    by_decile = (
        df.groupby("recal_decile")
        .agg(
            n=("patient_idx", "count"),
            sts_recal_mean=("sts_recal", "mean"),
            lgbm_mean=("lgbm_30d", "mean"),
            brdav_mean=("brdav_followup", "mean"),
            brdav_std=("brdav_followup", "std"),
            brdav_q25=("brdav_followup", lambda s: s.quantile(0.25)),
            brdav_q75=("brdav_followup", lambda s: s.quantile(0.75)),
            actual_mortality=("outcome_30d_mortality", "mean"),
        )
        .reset_index()
    )
    print()
    print("Per-decile of sts_recal:")
    print(by_decile.round(4).to_string(index=False))

    # ---------- Top-decile flagging agreement ----------
    sts_top = (df["sts_recal"] >= df["sts_recal"].quantile(0.90)).astype(int)
    brdav_top = (df["brdav_followup"] >= df["brdav_followup"].quantile(0.90)).astype(int)
    lgbm_top = (df["lgbm_30d"] >= df["lgbm_30d"].quantile(0.90)).astype(int)

    kappa_sts_brdav = cohen_kappa_score(sts_top, brdav_top)
    kappa_lgbm_brdav = cohen_kappa_score(lgbm_top, brdav_top)
    kappa_sts_lgbm = cohen_kappa_score(sts_top, lgbm_top)

    print()
    print("Top-decile flagging agreement (Cohen's κ):")
    print(f"  sts_recal × brdav: κ = {kappa_sts_brdav:.3f}")
    print(f"  lgbm × brdav:      κ = {kappa_lgbm_brdav:.3f}")
    print(f"  sts_recal × lgbm:  κ = {kappa_sts_lgbm:.3f}")

    # ---------- Calibration of OUR models against the synthetic 30-d outcome ----------
    # (brdav predicts a different endpoint, so an O/E vs 30-d outcome would be unfair.)
    actual_30d = df["outcome_30d_mortality"].mean()
    sts_raw_oe = actual_30d / df["sts_raw"].mean()
    sts_recal_oe = actual_30d / df["sts_recal"].mean()
    lgbm_oe = actual_30d / df["lgbm_30d"].mean()

    print()
    print(f"Synthetic 30-d mortality observed: {actual_30d:.3%}")
    print(f"  raw STS-PROM    O/E = {sts_raw_oe:.2f}")
    print(f"  recal STS-PROM  O/E = {sts_recal_oe:.2f}")
    print(f"  LightGBM        O/E = {lgbm_oe:.2f}")

    # ---------- Persist for frontend ----------
    artifact = {
        "n_patients": int(len(df)),
        "outcome_30d_mortality_observed": float(actual_30d),
        "spearman_rho": {
            "brdav_vs_sts_recal": float(rho_brdav_recal),
            "brdav_vs_sts_raw": float(rho_brdav_raw),
            "brdav_vs_lgbm_30d": float(rho_brdav_lgbm),
            "sts_recal_vs_lgbm_30d": float(rho_recal_lgbm),
        },
        "top_decile_kappa": {
            "sts_recal_vs_brdav": float(kappa_sts_brdav),
            "lgbm_vs_brdav": float(kappa_lgbm_brdav),
            "sts_recal_vs_lgbm": float(kappa_sts_lgbm),
        },
        "oe_ratio_30d": {
            "sts_raw": float(sts_raw_oe),
            "sts_recal": float(sts_recal_oe),
            "lgbm_30d": float(lgbm_oe),
        },
        "by_recal_decile": by_decile.round(5).to_dict(orient="records"),
        "scatter_sample": (
            df.sample(min(500, len(df)), random_state=7)
            [["sts_recal", "lgbm_30d", "brdav_followup", "outcome_30d_mortality"]]
            .round(5)
            .to_dict(orient="records")
        ),
    }
    OUTPUT_PATH.write_text(json.dumps(artifact, indent=2))
    print()
    print(f"Wrote analysis artifact -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
