"""Composite futility flag for TAVI.

Returns a 0-1 composite from multiple frailty / comorbidity / functional drivers.
Threshold 0.50 = futility flag raised. The clinical alternative when futility is
flagged is **medical therapy** (diuretics, neurohormonal blockade, palliative-care
referral) — NOT SAVR. SAVR carries higher operative mortality on the same frail
patient, so if TAVI is futile, surgery is more so.

Reference:
- Otto CM et al. 2020 ACC/AHA Valve Guideline (Class IIa: medical therapy for
  severe AS with limited life expectancy regardless of valve approach).
- Afilalo J et al. JACC 2017 — frailty in TAVI outcomes.
- Shimura T et al. JACC Cardiovasc Interv 2017 — CFS predicts 1-year mortality.
"""

from __future__ import annotations

from tavi_api.schemas import FutilityAssessment, PatientInput

_THRESHOLD = 0.50


def assess_futility(p: PatientInput) -> FutilityAssessment:
    """Composite futility score with transparent driver attribution."""
    score = 0.0
    drivers: list[str] = []

    # Severe frailty (Rockwood CFS) — strongest single predictor of 1-year mortality
    if p.clinical_frailty_scale is not None and p.clinical_frailty_scale >= 7:
        score += 0.30
        drivers.append(f"Severe frailty (CFS {p.clinical_frailty_scale} ≥ 7)")
    elif p.clinical_frailty_scale is not None and p.clinical_frailty_scale == 6:
        score += 0.10
        drivers.append("Moderate frailty (CFS 6)")

    # Advanced age
    if p.age_years > 90:
        score += 0.20
        drivers.append(f"Age > 90 ({p.age_years:.0f} years)")
    elif p.age_years > 85:
        score += 0.10
        drivers.append(f"Age > 85 ({p.age_years:.0f} years)")

    # Hypoalbuminemia (nutritional / inflammatory marker)
    if p.albumin_g_dl < 3.0:
        score += 0.20
        drivers.append(f"Hypoalbuminemia (albumin {p.albumin_g_dl:.1f} g/dL < 3.0)")
    elif p.albumin_g_dl < 3.5:
        score += 0.05
        drivers.append(f"Borderline albumin ({p.albumin_g_dl:.1f} g/dL)")

    # Dialysis dependence
    if p.on_dialysis:
        score += 0.15
        drivers.append("On dialysis")

    # Severe gait-speed reduction (frailty proxy)
    if p.gait_speed_m_per_s is not None and p.gait_speed_m_per_s < 0.5:
        score += 0.15
        drivers.append(
            f"Severe gait-speed reduction ({p.gait_speed_m_per_s:.2f} m/s < 0.5)"
        )

    # Multimorbidity (>=3 of: COPD, prior stroke, prior MI, prior CABG)
    multimorbidity_count = sum(
        [
            p.chronic_lung_disease,
            p.prior_stroke,
            p.prior_mi,
            p.prior_cabg,
            p.peripheral_vascular_disease,
        ]
    )
    if multimorbidity_count >= 3:
        score += 0.10
        drivers.append(
            f"Multimorbidity ({multimorbidity_count} of COPD/stroke/MI/CABG/PVD)"
        )

    # NYHA IV (advanced heart failure)
    if p.nyha_class == "IV":
        score += 0.05
        drivers.append("NYHA class IV")

    # LVEF < 25% (severe LV dysfunction)
    if p.lvef_pct < 25:
        score += 0.05
        drivers.append(f"Severely reduced LVEF ({p.lvef_pct:.0f}%)")

    score = min(score, 1.0)
    is_futile = score >= _THRESHOLD

    return FutilityAssessment(
        is_futile=is_futile,
        composite_score=round(score, 3),
        drivers=drivers,
    )
