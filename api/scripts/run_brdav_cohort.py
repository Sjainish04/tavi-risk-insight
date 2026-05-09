"""Batch-run our scoring pipeline + the brdav oracle on the synthetic cohort.

For each of the 5,000 synthetic patients:
  - raw STS-PROM (our reduced-form approximation)
  - recalibrated STS-PROM (era-aware O/E correction)
  - LightGBM probability (calibrated, with NaN-safe CT features)
  - brdav probability (Brüggemann 2024 Swin-UNETR, real-cohort-trained, follow-up endpoint)
Saves to ``api/artifacts/brdav_cohort.parquet`` for downstream analysis.

Run from repo root with the api venv:
    cd api && uv run python scripts/run_brdav_cohort.py

Requires the brdav microservice to be reachable at BRDAV_URL.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path

import httpx
import numpy as np
import pandas as pd

# Make tavi_api importable when run as a script
_REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO / "src"))

from tavi_api.data.synthetic import OUTCOME_COLUMN, generate_synthetic_cohort  # noqa: E402
from tavi_api.model.infer import load_model  # noqa: E402
from tavi_api.schemas import PatientInput  # noqa: E402
from tavi_api.scoring.recalibration import recalibrate_sts_prom  # noqa: E402
from tavi_api.scoring.sts_prom import sts_prom_30day_mortality  # noqa: E402

BRDAV_URL = "http://127.0.0.1:8001/infer"
ARTIFACTS_DIR = _REPO / "artifacts"
OUTPUT_PATH = ARTIFACTS_DIR / "brdav_cohort.parquet"


def _opt_float(v) -> float | None:
    """Convert pandas value to float-or-None (NaN -> None)."""
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def row_to_patient(row: pd.Series) -> PatientInput:
    """Synthetic cohort row -> PatientInput. Maps numeric NYHA/urgency back to strings."""
    nyha = {1: "I", 2: "II", 3: "III", 4: "IV"}[int(row["nyha_class_num"])]
    urgency = {0: "elective", 1: "urgent", 2: "emergent"}[int(row["urgency_num"])]
    return PatientInput(
        age_years=float(row["age_years"]),
        sex="female" if bool(row["sex_female"]) else "male",
        bmi=float(row["bmi"]),
        lvef_pct=float(row["lvef_pct"]),
        egfr=float(row["egfr"]),
        creatinine_mg_dl=float(row["creatinine_mg_dl"]),
        hemoglobin_g_dl=float(row["hemoglobin_g_dl"]),
        albumin_g_dl=float(row["albumin_g_dl"]),
        nt_probnp_pg_ml=_opt_float(row.get("nt_probnp_pg_ml")),
        diabetes=bool(row["diabetes"]),
        chronic_lung_disease=bool(row["chronic_lung_disease"]),
        prior_mi=bool(row["prior_mi"]),
        prior_pci=bool(row.get("prior_pci", False)),
        prior_cabg=bool(row["prior_cabg"]),
        prior_stroke=bool(row["prior_stroke"]),
        peripheral_vascular_disease=bool(row["peripheral_vascular_disease"]),
        atrial_fibrillation=bool(row["atrial_fibrillation"]),
        prior_pacemaker=bool(row["prior_pacemaker"]),
        on_dialysis=bool(row["on_dialysis"]),
        nyha_class=nyha,
        urgency=urgency,
        gait_speed_m_per_s=_opt_float(row.get("gait_speed_m_per_s")),
        annular_area_mm2=_opt_float(row.get("annular_area_mm2")),
        annular_perimeter_mm=None,  # not in synthetic schema
        calcium_volume_au=_opt_float(row.get("calcium_volume_au")),
        membranous_septum_length_mm=_opt_float(row.get("membranous_septum_length_mm")),
        distance_to_left_main_mm=_opt_float(row.get("distance_to_left_main_mm")),
    )


def patient_to_brdav(p: PatientInput) -> dict:
    """Map PatientInput -> brdav's tabular + measurements payload."""
    cad_proxy = bool(p.prior_pci or p.prior_mi)
    prior_cv_int = bool(p.prior_pci or p.prior_cabg)
    return {
        "tabular": {
            "AVA": None,
            "Age": p.age_years,
            "Aortic_regurgitation": None,
            "BMI": p.bmi,
            "Creatinine": p.creatinine_mg_dl * 88.4,  # mg/dL -> umol/L
            "Glomerular_filtration_rate": p.egfr,
            "Hemoglobin": p.hemoglobin_g_dl * 10.0,  # g/dL -> g/L
            "LVEF": p.lvef_pct,
            "Mean_transaortic_pressure_gradient": None,
            "Mitral_regurgitation": None,
            "Cerebrovascular_disease": p.prior_stroke,
            "Chronic_obstructive_pulmonary_disease": p.chronic_lung_disease,
            "Coronary_artery_bypass_grafting": p.prior_cabg,
            "Coronary_atheromatosis_or_stenosis": cad_proxy,
            "Diabetes_mellitus": p.diabetes,
            "Dyslipidemia": None,
            "Family_history_of_any_cardiovascular_disease": None,
            "Male_sex": p.sex == "male",
            "Hypertension": None,
            "Pacemaker_at_baseline": p.prior_pacemaker,
            "Peripheral_artery_disease": p.peripheral_vascular_disease,
            "Previous_cardiovascular_interventions": prior_cv_int,
            "Renal_replacement_or_dialysis": p.on_dialysis,
            "Smoking_status": None,
            "Valve_in_valve": False,
        },
        "measurements": {
            "Agatston_score_aortic_valve": None,
            "Area_derived_diameter_of_annulus_incl_calcification": None,
            "Area_of_annulus_incl_calcification": p.annular_area_mm2,
            "Calcification_of_ascending_aorta": None,
            "Calcification_of_sinotubular_junction": None,
            "Diameter_of_ascending_aorta": None,
            "LVOT_area": None,
            "LVOT_maximal_diameter": None,
            "Maximal_annulus_diameter": None,
            "Maximal_diameter_of_sinotubular_junction": None,
            "Perimeter_of_annulus_incl_calcification": p.annular_perimeter_mm,
            "Sinus_portion_maximal_diameter": None,
            "Volume_of_sinus_valsalva": None,
            "Volume_score_LVOT": None,
            "Volume_score_aortic_valve": p.calcium_volume_au,
        },
    }


def main() -> None:
    print("Generating synthetic cohort (n=5000) ...", flush=True)
    cohort = generate_synthetic_cohort(n=5000, seed=42)
    print(f"  cohort shape: {cohort.shape}, mortality rate {cohort[OUTCOME_COLUMN].mean():.3%}")

    print("Loading LightGBM model ...", flush=True)
    risk_model = load_model(_REPO / "models")

    print("Confirming brdav microservice is up ...", flush=True)
    health = httpx.get("http://127.0.0.1:8001/healthz", timeout=5).json()
    assert health["model_loaded"], f"brdav not ready: {health}"

    print("Scoring cohort ...", flush=True)
    rows: list[dict] = []
    t0 = time.perf_counter()
    with httpx.Client(timeout=30) as client:
        for i, row in cohort.iterrows():
            patient = row_to_patient(row)

            sts_raw = sts_prom_30day_mortality(patient)
            sts_recal, decile, oe_ratio = recalibrate_sts_prom(sts_raw)
            lgbm_prob, _ = risk_model.predict(patient)

            payload = patient_to_brdav(patient)
            r = client.post(BRDAV_URL, json=payload)
            r.raise_for_status()
            brdav_prob = r.json()["probability"]

            rows.append({
                "patient_idx": int(i),
                "age_years": patient.age_years,
                "sex_female": patient.sex == "female",
                "lvef_pct": patient.lvef_pct,
                "egfr": patient.egfr,
                "outcome_30d_mortality": int(row[OUTCOME_COLUMN]),
                "sts_raw": sts_raw,
                "sts_recal": sts_recal,
                "sts_decile": decile,
                "sts_oe_ratio": oe_ratio,
                "lgbm_30d": lgbm_prob,
                "brdav_followup": brdav_prob,
                "ct_complete": not pd.isna(row["annular_area_mm2"]),
            })

            if (i + 1) % 500 == 0:
                rate = (i + 1) / (time.perf_counter() - t0)
                print(f"  scored {i + 1}/5000 ({rate:.1f}/s)")

    df = pd.DataFrame(rows)
    elapsed = time.perf_counter() - t0
    print(f"Total scoring time: {elapsed:.1f}s ({len(df) / elapsed:.1f}/s)")

    ARTIFACTS_DIR.mkdir(exist_ok=True)
    df.to_parquet(OUTPUT_PATH)
    print(f"Saved {len(df)} rows -> {OUTPUT_PATH}")
    print()
    print("Probability summary:")
    print(df[["sts_raw", "sts_recal", "lgbm_30d", "brdav_followup"]].describe().round(3))


if __name__ == "__main__":
    main()
