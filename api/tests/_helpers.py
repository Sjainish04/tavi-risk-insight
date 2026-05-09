"""Shared test helpers."""

from __future__ import annotations

from tavi_api.schemas import PatientInput


def patient(**overrides) -> PatientInput:
    """Build a baseline severe-AS patient for testing; override any field."""
    base = dict(
        age_years=78,
        sex="male",
        bmi=27,
        lvef_pct=55,
        egfr=60,
        creatinine_mg_dl=1.0,
        hemoglobin_g_dl=13.0,
        albumin_g_dl=4.0,
        aortic_valve_area_cm2=0.7,
        mean_aortic_gradient_mmhg=45,
        peak_aortic_velocity_m_per_s=4.3,
        nyha_class="II",
        urgency="elective",
    )
    base.update(overrides)
    return PatientInput(**base)
