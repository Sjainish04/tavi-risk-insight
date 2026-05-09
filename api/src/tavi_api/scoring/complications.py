"""Procedural complication risks for TAVI (VARC-3 endpoints).

Computes 30-day risk for:
- Disabling stroke
- Acute kidney injury stage 2-3
- Major vascular complication
- Life-threatening or major bleeding

Approach: published baseline rates from contemporary TAVI literature multiplied
by patient-specific multiplicative modifiers. CI is heuristic ±25% of the point
estimate (documented limitation; for a real model, use a bootstrap from a
calibration cohort).

Baselines (PARTNER 3, Evolut Low Risk, contemporary TVT registry, VARC-3 papers):
- Disabling stroke 30d: ~1.2%
- AKI stage 2-3 30d: ~2.5%
- Major vascular complication 30d: ~2.5%
- Life-threatening bleed 30d: ~3.0%

Multiplier sources cited inline.
"""

from __future__ import annotations

from tavi_api.schemas import ComplicationRisks, PatientInput, ProbabilityWithCI

# VARC-3 contemporary baselines
_BASE_STROKE = 0.012
_BASE_AKI = 0.025
_BASE_VASCULAR = 0.025
_BASE_BLEED = 0.030

_CI_FRACTION = 0.25  # ±25% of point estimate (heuristic)
_MAX_P = 0.30  # clamp upper bound to plausible per-event range


def _ci(p: float) -> tuple[float, float]:
    lo = max(0.001, p * (1 - _CI_FRACTION))
    hi = min(_MAX_P, p * (1 + _CI_FRACTION))
    return round(lo, 4), round(hi, 4)


def _wrap(p: float, base: float) -> ProbabilityWithCI:
    p = min(_MAX_P, max(0.001, p))
    lo, hi = _ci(p)
    return ProbabilityWithCI(
        p=round(p, 4),
        lo=lo,
        hi=hi,
        base_rate=base,
        multiplier_vs_base=round(p / base, 2) if base > 0 else 0.0,
    )


def _stroke(p: PatientInput) -> ProbabilityWithCI:
    """Disabling stroke at 30d. Modifiers: prior stroke ×2.5, AFib ×1.5, eGFR<30 ×1.4
    (Kapadia 2017, Auffret 2017, Eggebrecht 2019).
    """
    risk = _BASE_STROKE
    if p.prior_stroke:
        risk *= 2.5
    if p.atrial_fibrillation:
        risk *= 1.5
    if p.egfr < 30:
        risk *= 1.4
    if p.age_years >= 85:
        risk *= 1.2
    return _wrap(risk, _BASE_STROKE)


def _aki(p: PatientInput) -> ProbabilityWithCI:
    """AKI stage 2-3 at 30d. Modifiers: eGFR<45 ×2.5, LVEF<35 ×1.5, diabetes ×1.4,
    contrast surrogate via creatinine>2 ×1.3 (Nuis 2012, Gargiulo 2015).
    """
    risk = _BASE_AKI
    if p.egfr < 45:
        risk *= 2.5
    elif p.egfr < 60:
        risk *= 1.5
    if p.lvef_pct < 35:
        risk *= 1.5
    if p.diabetes:
        risk *= 1.4
    if p.creatinine_mg_dl > 2.0:
        risk *= 1.3
    if p.on_dialysis:
        risk = 0.001  # already on RRT — AKI as defined doesn't apply
    return _wrap(risk, _BASE_AKI)


def _vascular(p: PatientInput) -> ProbabilityWithCI:
    """Major vascular complication at 30d. Modifiers: PVD ×3.0, female ×1.4,
    BMI<22 ×1.3 (van Mieghem 2013, Genereux 2012).
    """
    risk = _BASE_VASCULAR
    if p.peripheral_vascular_disease:
        risk *= 3.0
    if p.sex == "female":
        risk *= 1.4
    if p.bmi < 22:
        risk *= 1.3
    return _wrap(risk, _BASE_VASCULAR)


def _bleed(p: PatientInput) -> ProbabilityWithCI:
    """Life-threatening or major bleed at 30d. Modifiers: anemia (Hb<11) ×2.0,
    AFib (oral-anticoagulant proxy) ×1.7, prior PCI (DAPT proxy) ×1.3
    (Genereux 2014, Piccolo 2017).
    """
    risk = _BASE_BLEED
    if p.hemoglobin_g_dl < 11:
        risk *= 2.0
    elif p.hemoglobin_g_dl < 12:
        risk *= 1.4
    if p.atrial_fibrillation:
        risk *= 1.7
    if p.prior_pci:
        risk *= 1.3
    if p.albumin_g_dl < 3.0:
        risk *= 1.2
    return _wrap(risk, _BASE_BLEED)


def compute_complications(p: PatientInput) -> ComplicationRisks:
    """Compute the four 30-day procedural complications."""
    return ComplicationRisks(
        stroke_30d=_stroke(p),
        aki_2_3_30d=_aki(p),
        major_vascular_30d=_vascular(p),
        life_threatening_bleed_30d=_bleed(p),
    )
