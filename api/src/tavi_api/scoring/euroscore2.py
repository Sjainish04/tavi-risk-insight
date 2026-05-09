"""Reduced-form EuroSCORE II implementation.

Approximation of the EuroSCORE II model (Nashef 2012, Eur J Cardiothorac Surg)
using the most influential of the 18 published covariates. Calibrated against
the public euroscore.org calculator on a small set of canonical cases.

Reference: Nashef SAM et al. Eur J Cardiothorac Surg 2012;41(4):734–745.
https://pubmed.ncbi.nlm.nih.gov/22378855/
"""

from __future__ import annotations

import math

from tavi_api.schemas import PatientInput

_INTERCEPT = -5.32
_COEFFS: dict[str, float] = {
    "age_per_year_over_60": 0.0285,
    "female": 0.20,
    "egfr_30_50": 0.34,
    "egfr_under_30": 1.05,
    "on_dialysis": 1.20,
    "extracardiac_arteriopathy": 0.45,
    "chronic_lung_disease": 0.35,
    "diabetes_on_insulin": 0.30,
    "nyha_iii": 0.40,
    "nyha_iv": 0.95,
    "lvef_31_50": 0.30,
    "lvef_21_30": 0.85,
    "lvef_under_21": 1.20,
    "recent_mi": 0.45,
    "urgency_urgent": 0.40,
    "urgency_emergent": 1.10,
    "prior_cardiac_surgery": 0.95,
}


def _sigmoid(x: float) -> float:
    return 1.0 / (1.0 + math.exp(-x))


def _build_features(p: PatientInput) -> dict[str, float]:
    egfr_30_50 = 1.0 if 30 <= p.egfr < 50 else 0.0
    egfr_under_30 = 1.0 if p.egfr < 30 else 0.0
    lvef_31_50 = 1.0 if 31 <= p.lvef_pct <= 50 else 0.0
    lvef_21_30 = 1.0 if 21 <= p.lvef_pct <= 30 else 0.0
    lvef_under_21 = 1.0 if p.lvef_pct < 21 else 0.0

    return {
        "age_per_year_over_60": max(0.0, p.age_years - 60),
        "female": 1.0 if p.sex == "female" else 0.0,
        "egfr_30_50": egfr_30_50,
        "egfr_under_30": egfr_under_30,
        "on_dialysis": float(p.on_dialysis),
        "extracardiac_arteriopathy": float(p.peripheral_vascular_disease),
        "chronic_lung_disease": float(p.chronic_lung_disease),
        "diabetes_on_insulin": float(p.diabetes),  # approximation
        "nyha_iii": 1.0 if p.nyha_class == "III" else 0.0,
        "nyha_iv": 1.0 if p.nyha_class == "IV" else 0.0,
        "lvef_31_50": lvef_31_50,
        "lvef_21_30": lvef_21_30,
        "lvef_under_21": lvef_under_21,
        "recent_mi": float(p.prior_mi),  # approximation; full model uses 90-day window
        "urgency_urgent": 1.0 if p.urgency == "urgent" else 0.0,
        "urgency_emergent": 1.0 if p.urgency == "emergent" else 0.0,
        "prior_cardiac_surgery": float(p.prior_cabg),
    }


def euroscore_ii(patient: PatientInput) -> float:
    """Predicted in-hospital mortality after major cardiac surgery (EuroSCORE II)."""
    feats = _build_features(patient)
    z = _INTERCEPT + sum(_COEFFS[k] * v for k, v in feats.items())
    return max(0.001, min(0.60, _sigmoid(z)))
