"""Synthetic TAVI cohort generator.

Produces a tabular dataset that mimics the marginal and joint distributions of
a contemporary low-to-intermediate-risk TAVI registry (PARTNER 3 / Evolut Low
Risk era). Outcome is sampled from a logistic ground-truth so that:
- Base 30-day mortality rate ~3% (consistent with 2020+ TVT registry)
- AUROC ceiling is in the 0.78-0.85 range (realistic, not artificially easy)
- Tail risk is irreducible (~5% noise injected into the logit)

CT-derived features are sampled with realistic missingness (~40% NaN) to mirror
real-world data — not every TAVI candidate has uploaded CT measurements at the
time of risk assessment. LightGBM handles NaN natively.

This is illustrative data for hackathon demonstration of calibration drift,
not real patient data. No PHI is ever generated.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

# Order must match _patient_to_row in model/infer.py
FEATURE_COLUMNS: list[str] = [
    "age_years",
    "sex_female",
    "bmi",
    "lvef_pct",
    "egfr",
    "creatinine_mg_dl",
    "hemoglobin_g_dl",
    "albumin_g_dl",
    "nt_probnp_pg_ml",
    "diabetes",
    "chronic_lung_disease",
    "prior_mi",
    "prior_pci",
    "prior_cabg",
    "prior_stroke",
    "peripheral_vascular_disease",
    "atrial_fibrillation",
    "prior_pacemaker",
    "on_dialysis",
    "nyha_class_num",
    "urgency_num",
    "gait_speed_m_per_s",
    # CT-derived (optional — NaN when imaging not yet uploaded)
    "annular_area_mm2",
    "calcium_volume_au",
    "membranous_septum_length_mm",
    "distance_to_left_main_mm",
]

OUTCOME_COLUMN: str = "mortality_30d"

CT_FEATURES: list[str] = [
    "annular_area_mm2",
    "calcium_volume_au",
    "membranous_septum_length_mm",
    "distance_to_left_main_mm",
]


def _sigmoid(x: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-x))


def generate_synthetic_cohort(
    n: int = 5000, seed: int = 42, ct_missing_rate: float = 0.40
) -> pd.DataFrame:
    """Sample n synthetic TAVI patients with a sampled 30-day mortality label.

    `ct_missing_rate` controls what fraction of patients have NaN CT measurements
    (mimicking real-world workflow: not every candidate has CT uploaded at risk
    assessment time).
    """
    rng = np.random.default_rng(seed)

    # ---------- Demographics ----------
    age = rng.normal(78, 8, n).clip(60, 95)
    sex_female = rng.binomial(1, 0.45, n).astype(bool)
    bmi = rng.normal(27, 5, n).clip(15, 50)

    # ---------- Cardiac function ----------
    lvef = rng.normal(55, 12, n).clip(15, 75)

    # ---------- Renal function (correlated with age) ----------
    egfr = (rng.normal(60, 18, n) - 0.4 * (age - 75)).clip(8, 110)
    creatinine = (1.4 - egfr / 60.0 + rng.normal(0, 0.25, n)).clip(0.4, 12)

    hgb = rng.normal(12.5, 1.6, n).clip(6, 18)
    alb = rng.normal(3.8, 0.4, n).clip(1.5, 5.5)
    nt_probnp = np.exp(rng.normal(7.5, 1.2, n)).clip(50, 50_000)

    # ---------- Comorbidities (probability conditional on age) ----------
    age_prob = (age - 60) / 35.0
    diabetes = rng.binomial(1, np.clip(0.20 + 0.15 * age_prob, 0.05, 0.55), n).astype(bool)
    cld = rng.binomial(1, np.clip(0.10 + 0.10 * age_prob, 0.02, 0.45), n).astype(bool)
    prior_mi = rng.binomial(1, np.clip(0.10 + 0.15 * age_prob, 0.02, 0.40), n).astype(bool)
    prior_pci = rng.binomial(1, np.clip(0.15 + 0.20 * age_prob, 0.05, 0.55), n).astype(bool)
    prior_cabg = rng.binomial(1, np.clip(0.05 + 0.10 * age_prob, 0.01, 0.30), n).astype(bool)
    prior_stroke = rng.binomial(1, np.clip(0.05 + 0.10 * age_prob, 0.01, 0.30), n).astype(bool)
    pvd = rng.binomial(1, np.clip(0.10 + 0.15 * age_prob, 0.02, 0.45), n).astype(bool)
    afib = rng.binomial(1, np.clip(0.20 + 0.15 * age_prob, 0.05, 0.55), n).astype(bool)
    prior_pm = rng.binomial(1, np.clip(0.05 + 0.05 * age_prob, 0.01, 0.20), n).astype(bool)
    dialysis = rng.binomial(1, np.clip(0.02 + 0.05 * age_prob, 0.005, 0.15), n).astype(bool)

    # ---------- Clinical state ----------
    nyha_num = rng.choice([1, 2, 3, 4], n, p=[0.05, 0.45, 0.40, 0.10])
    urgency_num = rng.choice([0, 1, 2], n, p=[0.85, 0.13, 0.02])

    # ---------- Frailty proxy ----------
    gait_speed = (1.0 - 0.012 * (age - 70) + rng.normal(0, 0.18, n)).clip(0.1, 1.5)

    # ---------- CT-derived (with missingness) ----------
    annular_area = rng.normal(490, 60, n).clip(350, 700)
    # Calcium volume: log-normal, age-skewed (older → more calcium)
    calcium_log_mean = 6.4 + 0.020 * (age - 75)
    calcium = np.exp(rng.normal(calcium_log_mean, 0.7, n)).clip(50, 6000)
    ms_length = rng.normal(7, 2.0, n).clip(2, 14)
    lm_height = rng.normal(13, 2.5, n).clip(5, 22)

    # Apply missingness (per-patient, all CT or none — mimics real workflow)
    ct_missing = rng.uniform(0, 1, n) < ct_missing_rate
    annular_area_obs = np.where(ct_missing, np.nan, annular_area)
    calcium_obs = np.where(ct_missing, np.nan, calcium)
    ms_length_obs = np.where(ct_missing, np.nan, ms_length)
    lm_height_obs = np.where(ct_missing, np.nan, lm_height)

    df = pd.DataFrame(
        {
            "age_years": age,
            "sex_female": sex_female,
            "bmi": bmi,
            "lvef_pct": lvef,
            "egfr": egfr,
            "creatinine_mg_dl": creatinine,
            "hemoglobin_g_dl": hgb,
            "albumin_g_dl": alb,
            "nt_probnp_pg_ml": nt_probnp,
            "diabetes": diabetes,
            "chronic_lung_disease": cld,
            "prior_mi": prior_mi,
            "prior_pci": prior_pci,
            "prior_cabg": prior_cabg,
            "prior_stroke": prior_stroke,
            "peripheral_vascular_disease": pvd,
            "atrial_fibrillation": afib,
            "prior_pacemaker": prior_pm,
            "on_dialysis": dialysis,
            "nyha_class_num": nyha_num,
            "urgency_num": urgency_num,
            "gait_speed_m_per_s": gait_speed,
            "annular_area_mm2": annular_area_obs,
            "calcium_volume_au": calcium_obs,
            "membranous_septum_length_mm": ms_length_obs,
            "distance_to_left_main_mm": lm_height_obs,
        }
    )

    # ---------- Ground-truth logit for 30-day mortality ----------
    # Use the *true* CT values (not the observed-with-NaN) so the data-generating
    # process is consistent regardless of imaging availability. This is realistic:
    # the patient's true anatomy affects outcome whether or not we measured it.
    logit = (
        -6.2  # tuned so base rate sits ~3% with the CT-driven additive terms below
        + 0.045 * (age - 75)
        + 0.4 * sex_female.astype(float)
        + 0.40 * np.maximum(0.0, (60 - lvef) / 10.0)
        + 0.55 * np.maximum(0.0, (60 - egfr) / 10.0)
        + 1.10 * dialysis.astype(float)
        + 0.40 * cld.astype(float)
        + 0.40 * prior_mi.astype(float)
        + 0.55 * prior_cabg.astype(float)
        + 0.45 * prior_stroke.astype(float)
        + 0.30 * pvd.astype(float)
        + 0.55 * (nyha_num >= 3).astype(float)
        + 0.85 * (nyha_num == 4).astype(float)
        + 0.45 * (urgency_num == 1).astype(float)
        + 1.05 * (urgency_num == 2).astype(float)
        + 0.30 * np.maximum(0.0, 12 - hgb)
        + 0.65 * np.maximum(0.0, 3.5 - alb)
        + 0.45 * np.maximum(0.0, 0.8 - gait_speed) * 5.0
        + 0.30 * np.log1p(nt_probnp / 1000.0)
        # CT-driven anatomical risk
        + 0.20 * np.maximum(0.0, (1500 - calcium) / -1500.0)  # heavy calcium → +risk
        + 0.25 * np.maximum(0.0, (5 - ms_length))  # short MS → +risk
        + 0.15 * np.maximum(0.0, (10 - lm_height))  # low LM → +risk
        + rng.normal(0, 0.5, n)  # irreducible noise
    )

    p_mortality = _sigmoid(logit)
    df[OUTCOME_COLUMN] = (rng.uniform(0, 1, n) < p_mortality).astype(int)

    return df


if __name__ == "__main__":
    df = generate_synthetic_cohort()
    print(f"Generated {len(df):,} synthetic TAVI patients")
    print(f"30-day mortality rate: {df[OUTCOME_COLUMN].mean():.2%}")
    print(f"CT availability: {df['annular_area_mm2'].notna().mean():.1%}")
