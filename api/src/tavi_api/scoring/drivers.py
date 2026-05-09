"""Render SHAP top-5 contributions in clinical language with modifiable flags.

Maps raw feature names (e.g., `albumin_g_dl`) to clinician-friendly labels
(e.g., "Albumin 2.9 g/dL") and tags whether the factor is modifiable before
the procedure.

Modifiable factors (as defined in this prototype):
- Albumin (nutritional optimization)
- Hemoglobin (treat anemia)
- Gait speed (PT/rehab)
- NYHA class (medical optimization)
"""

from __future__ import annotations

from collections.abc import Sequence

from tavi_api.schemas import RiskScoreDriver, ShapContribution

# Sigmoid scale-factor for converting log-odds SHAP values to approximate
# probability impact (in percentage points). Uses the working-point slope of
# the logistic at the cohort base rate (~3-5%): dp/dlogit ≈ p*(1-p).
_BASE_RATE = 0.04
_LOGIT_TO_PP = _BASE_RATE * (1 - _BASE_RATE) * 100.0  # ≈ 3.84 pp per logit unit

_CLINICAL_LABELS: dict[str, tuple[str, str]] = {
    # name -> (display_label_template, unit)
    "age_years": ("Age", "yrs"),
    "sex_female": ("Sex", ""),
    "bmi": ("BMI", "kg/m²"),
    "lvef_pct": ("LVEF", "%"),
    "egfr": ("eGFR", "mL/min/1.73m²"),
    "creatinine_mg_dl": ("Creatinine", "mg/dL"),
    "hemoglobin_g_dl": ("Hemoglobin", "g/dL"),
    "albumin_g_dl": ("Albumin", "g/dL"),
    "nt_probnp_pg_ml": ("NT-proBNP", "pg/mL"),
    "diabetes": ("Diabetes", ""),
    "chronic_lung_disease": ("COPD / lung disease", ""),
    "prior_mi": ("Prior MI", ""),
    "prior_pci": ("Prior PCI", ""),
    "prior_cabg": ("Prior CABG", ""),
    "prior_stroke": ("Prior stroke", ""),
    "peripheral_vascular_disease": ("Peripheral vascular disease", ""),
    "atrial_fibrillation": ("Atrial fibrillation", ""),
    "prior_pacemaker": ("Prior pacemaker", ""),
    "on_dialysis": ("On dialysis", ""),
    "nyha_class_num": ("NYHA class", ""),
    "urgency_num": ("Urgency", ""),
    "gait_speed_m_per_s": ("Gait speed", "m/s"),
    "annular_area_mm2": ("Annular area", "mm²"),
    "calcium_volume_au": ("Aortic-valve calcium", "AU"),
    "membranous_septum_length_mm": ("Membranous septum", "mm"),
    "distance_to_left_main_mm": ("Left-main height", "mm"),
}

_MODIFIABLE: dict[str, str] = {
    "albumin_g_dl": "≥ 3.5 g/dL before procedure (nutrition consult)",
    "hemoglobin_g_dl": "≥ 12 g/dL (treat anemia: iron / EPO / transfusion if appropriate)",
    "gait_speed_m_per_s": "≥ 0.85 m/s (pre-habilitation, PT)",
    "nyha_class_num": "≤ NYHA II (optimize HF therapy: GDMT, diuretics)",
}


def _format_value(name: str, raw_value) -> str:
    """Render a feature value as a human-readable string."""
    if name in {
        "sex_female",
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
    }:
        return "yes" if bool(raw_value) else "no"
    if name == "nyha_class_num":
        try:
            return ["I", "II", "III", "IV"][int(raw_value) - 1]
        except (TypeError, ValueError, IndexError):
            return str(raw_value)
    if name == "urgency_num":
        try:
            return ["elective", "urgent", "emergent"][int(raw_value)]
        except (TypeError, ValueError, IndexError):
            return str(raw_value)
    try:
        return f"{float(raw_value):.1f}"
    except (TypeError, ValueError):
        return str(raw_value)


def _build_label(name: str, raw_value) -> str:
    label_tmpl = _CLINICAL_LABELS.get(name, (name, ""))
    label, unit = label_tmpl
    if name == "sex_female":
        return f"Sex: {'female' if bool(raw_value) else 'male'}"
    value_str = _format_value(name, raw_value)
    if unit:
        return f"{label} {value_str} {unit}"
    return f"{label}: {value_str}"


def to_clinical_drivers(
    shap_top5: Sequence[ShapContribution] | Sequence[dict],
) -> list[RiskScoreDriver]:
    """Convert SHAP top-5 to clinical-language drivers with modifiable flags."""
    drivers: list[RiskScoreDriver] = []
    for s in shap_top5:
        if isinstance(s, dict):
            feature = s["feature"]
            value = s.get("value")
            shap_val = float(s["shap_value"])
            direction = s["direction"]
        else:
            feature = s.feature
            value = s.value
            shap_val = float(s.shap_value)
            direction = s.direction
        magnitude_pp = abs(shap_val) * _LOGIT_TO_PP
        drivers.append(
            RiskScoreDriver(
                feature_label=_build_label(feature, value),
                raw_feature_name=feature,
                current_value=_format_value(feature, value),
                effect="increases" if direction == "increases" else "decreases",
                magnitude_pp=round(magnitude_pp, 2),
                is_modifiable=feature in _MODIFIABLE,
                modify_to=_MODIFIABLE.get(feature),
            )
        )
    return drivers


def top_modifiable(drivers: list[RiskScoreDriver]) -> RiskScoreDriver | None:
    """Return the highest-impact modifiable driver, or None."""
    modifiables = [d for d in drivers if d.is_modifiable and d.effect == "increases"]
    if not modifiables:
        return None
    return max(modifiables, key=lambda d: d.magnitude_pp)
