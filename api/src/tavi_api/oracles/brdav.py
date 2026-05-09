"""Brüggemann 2024 (brdav) oracle — calls the local microservice on :8001.

The mapping between our PatientInput schema and brdav's 25 tabular + 15 measurement
fields is centralized here so the live /predict path and offline batch scripts
stay in sync.
"""

from __future__ import annotations

import os
from typing import Any

import httpx

from tavi_api.schemas import PatientInput

DEFAULT_BRDAV_URL = os.environ.get("BRDAV_URL", "http://127.0.0.1:8001/infer")
_TIMEOUT_S = 5.0


def to_brdav_payload(p: PatientInput) -> dict[str, dict[str, Any]]:
    """Map our PatientInput to brdav's tabular + measurements payload."""
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


async def predict_brdav(p: PatientInput, url: str = DEFAULT_BRDAV_URL) -> tuple[float, int] | None:
    """Call the brdav microservice. Returns (probability, took_ms) or None on failure."""
    payload = to_brdav_payload(p)
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_S) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
            return float(data["probability"]), int(data.get("took_ms", -1))
    except (httpx.HTTPError, KeyError, ValueError):
        return None
