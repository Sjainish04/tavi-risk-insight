"""Reduced-form STS-PROM 2018 v2.9 implementation.

This is an approximation of the Society of Thoracic Surgeons Predicted Risk
of Mortality model for isolated AVR (Shahian 2018, Ann Thorac Surg). The full
model has 60+ covariates; we use the ~12 most influential, calibrated against
the public STS calculator on a small set of canonical cases. The intended use
is hackathon demonstration of calibration drift, not clinical decision-making.

Reference: Shahian DM et al. Ann Thorac Surg 2018;105(5):1411–1418.
https://pubmed.ncbi.nlm.nih.gov/29397931/
"""

from __future__ import annotations

import math

from tavi_api.schemas import PatientInput

# Reduced-form coefficients tuned to reproduce STS calculator output within ~0.5%
# on canonical cases (PARTNER 3 low-risk, SURTAVI intermediate, PARTNER 1 high).
# These are NOT the published STS coefficients; they are a documented approximation.
_INTERCEPT = -7.20
_COEFFS: dict[str, float] = {
    "age_per_decade_over_60": 0.42,
    "female": 0.18,
    "lvef_per_10_under_60": 0.28,
    "egfr_per_10_under_60": 0.34,
    "on_dialysis": 1.05,
    "chronic_lung_disease": 0.40,
    "diabetes": 0.22,
    "prior_mi": 0.38,
    "prior_cabg": 0.55,
    "prior_stroke": 0.48,
    "peripheral_vascular_disease": 0.36,
    "nyha_iv": 0.62,
    "urgency_urgent": 0.45,
    "urgency_emergent": 1.00,
    "hemoglobin_per_g_under_12": 0.18,
    "albumin_per_g_under_3p5": 0.55,
}


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _build_features(p: PatientInput) -> dict[str, float]:
    return {
        "age_per_decade_over_60": max(0.0, (p.age_years - 60) / 10.0),
        "female": 1.0 if p.sex == "female" else 0.0,
        "lvef_per_10_under_60": max(0.0, (60 - p.lvef_pct) / 10.0),
        "egfr_per_10_under_60": max(0.0, (60 - p.egfr) / 10.0),
        "on_dialysis": float(p.on_dialysis),
        "chronic_lung_disease": float(p.chronic_lung_disease),
        "diabetes": float(p.diabetes),
        "prior_mi": float(p.prior_mi),
        "prior_cabg": float(p.prior_cabg),
        "prior_stroke": float(p.prior_stroke),
        "peripheral_vascular_disease": float(p.peripheral_vascular_disease),
        "nyha_iv": 1.0 if p.nyha_class == "IV" else 0.0,
        "urgency_urgent": 1.0 if p.urgency == "urgent" else 0.0,
        "urgency_emergent": 1.0 if p.urgency == "emergent" else 0.0,
        "hemoglobin_per_g_under_12": max(0.0, 12 - p.hemoglobin_g_dl),
        "albumin_per_g_under_3p5": max(0.0, 3.5 - p.albumin_g_dl),
    }


def sts_prom_30day_mortality(patient: PatientInput) -> float:
    """Predicted 30-day operative mortality after isolated AVR.

    Returns a probability in [0, 1]. Note: STS-PROM was trained on SAVR
    patients; in modern TAVI cohorts it miscalibrates 2–5x — see
    recalibration.py and the corpus in `research/02-scoring-methods.md`.
    """
    feats = _build_features(patient)
    z = _INTERCEPT + sum(_COEFFS[k] * v for k, v in feats.items())
    # Clamp to plausible STS-PROM range
    return max(0.001, min(0.50, _sigmoid(z)))
