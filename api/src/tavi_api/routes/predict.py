"""POST /predict — runs all risk scores + the production model + SHAP for a patient,
plus severity, futility, procedural complications, per-device sizing, coronary risk,
and special considerations.

Production model selection at request time:
  1. If brdav microservice (:8001) is reachable AND v3 stacking artifacts loaded
     → use v3 stacking (LGBM + CatBoost + LR with brdav as feature 27).
     Bootstrap-AUROC winner among local models (0.781 vs v1's 0.743).
  2. Otherwise → fall back to v1 LightGBM. Predictable, fully offline.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from tavi_api.oracles.brdav import predict_brdav
from tavi_api.schemas import (
    AnnularSizing,
    DecisionCurvePoint,
    DeviceAssessment,
    PatientInput,
    RiskOutput,
    ScoreEstimate,
)
from tavi_api.scoring import (
    assess_futility,
    assess_severity,
    assign_decile,
    compute_complications,
    euroscore_ii,
    is_miscalibration_zone,
    load_boundaries,
    miscalibration_message,
    recalibrate_sts_prom,
    sts_prom_30day_mortality,
    to_clinical_drivers,
    tvt_in_hospital_mortality,
    wilson_ci,
)
from tavi_api.simulation import simulate_devices
from tavi_api.sizing import (
    considerations_for_patient,
    coronary_obstruction_risk,
    size_for_device,
)

router = APIRouter()

# Threshold range for decision curve analysis (Vickers & Elkin 2006)
DCA_THRESHOLDS = [round(t, 3) for t in [0.01, 0.02, 0.03, 0.05, 0.07, 0.10, 0.15, 0.20]]

# Cohort base rate (synthetic ~3% target; observed 4.76% — see model_comparison.json)
_COHORT_BASE_RATE = 0.03

# Map our internal valve labels to the sizing-module device keys
_VALVE_TO_DEVICE_KEY = {
    "Edwards SAPIEN 3 Ultra": "sapien_3_ultra",
    "Medtronic Evolut FX+": "evolut_fx_plus",
    "Abbott Navitor": "navitor",
}


def _decision_curve(prob: float, base_rate: float = _COHORT_BASE_RATE) -> list[DecisionCurvePoint]:
    """Single-patient threshold-payoff visualization (NOT population DCA)."""
    points: list[DecisionCurvePoint] = []
    for t in DCA_THRESHOLDS:
        if prob >= t:
            nb_model = (prob - t) / max(1e-6, 1 - t)
        else:
            nb_model = 0.0
        nb_all = base_rate - (1 - base_rate) * t / max(1e-6, 1 - t)
        points.append(
            DecisionCurvePoint(
                threshold=t,
                net_benefit_model=round(nb_model, 4),
                net_benefit_treat_all=round(nb_all, 4),
            )
        )
    return points


@router.post("/predict", response_model=RiskOutput)
async def predict(patient: PatientInput, request: Request) -> RiskOutput:
    # ---------- Phase 1: severity + futility ----------
    severity = assess_severity(patient)
    futility = assess_futility(patient)

    # ---------- Validated calculator outputs ----------
    sts_raw = sts_prom_30day_mortality(patient)
    sts_recal, decile, oe = recalibrate_sts_prom(sts_raw)
    es2 = euroscore_ii(patient)
    tvt = tvt_in_hospital_mortality(patient)

    # ---------- Production model selection (v3 stacking ↔ v1 LGBM) ----------
    v1_model = getattr(request.app.state, "risk_model", None)
    v3_model = getattr(request.app.state, "stacking_model", None)
    if v1_model is None:
        raise HTTPException(
            status_code=503, detail="LightGBM not loaded — run `uv run tavi-train`."
        )

    brdav_result = await predict_brdav(patient)
    brdav_score: ScoreEstimate | None = None
    if brdav_result is not None and v3_model is not None:
        brdav_prob, brdav_ms = brdav_result
        primary_prob, shap_top5 = v3_model.predict(patient, brdav_prob)
        primary_name = "Stacking ensemble · LGBM + CatBoost + LR + brdav"
        primary_model_name = "v3_stacking_brdav"
        brdav_score = ScoreEstimate(
            name="Brüggemann 2024 (real cohort, n=1,449)",
            raw_probability=round(brdav_prob, 4),
            miscalibration_note=(
                f"All-cause follow-up mortality (different endpoint than 30-d). "
                f"Cloud inference {brdav_ms} ms via Prior Labs / local microservice."
            ),
        )
    else:
        primary_prob, shap_top5 = v1_model.predict(patient)
        primary_name = "LightGBM v1 (synthetic cohort)"
        primary_model_name = "v1_lgbm"

    # ---------- Risk-score accompaniments (CI, decile, base-rate, drivers) ----------
    boundaries = load_boundaries("models")
    lgbm_decile = assign_decile(primary_prob, boundaries)
    n_train = int((v1_model.metadata.get("training_rows", 4000) or 4000))
    lgbm_lo, lgbm_hi = wilson_ci(primary_prob, n_train)
    base_rate_multiplier = round(primary_prob / max(1e-6, _COHORT_BASE_RATE), 2)
    risk_score_drivers = to_clinical_drivers(shap_top5)

    # ---------- Phase 2: procedural complications ----------
    complication_risks = compute_complications(patient)

    # ---------- Calibration drift ----------
    miscal = is_miscalibration_zone(sts_raw, sts_recal)

    # ---------- Phase 3: per-device assessments ----------
    legacy_sims = simulate_devices(patient, mort_baseline=sts_recal)
    device_assessments: list[DeviceAssessment] = []
    for sim in legacy_sims:
        device_key = _VALVE_TO_DEVICE_KEY.get(sim.valve)
        if device_key:
            sizing = size_for_device(
                annular_area_mm2=patient.annular_area_mm2,
                annular_perimeter_mm=patient.annular_perimeter_mm,
                device=device_key,  # type: ignore[arg-type]
            )
        else:
            sizing = AnnularSizing(
                recommended_size_mm=None,
                recommended_size_label=f"{sim.valve} — sizing table unavailable",
                oversizing_pct=None,
                in_range=False,
                note="No sizing table registered for this device.",
            )
        coronary_risk = coronary_obstruction_risk(
            distance_to_left_main_mm=patient.distance_to_left_main_mm,
            distance_to_right_coronary_mm=patient.distance_to_right_coronary_mm,
            sinus_of_valsalva_diameter_mm=patient.sinus_of_valsalva_diameter_mm,
            valve_class=sim.valve_class,
        )
        considerations = considerations_for_patient(patient, valve_class=sim.valve_class)
        device_assessments.append(
            DeviceAssessment(
                valve=sim.valve,
                valve_class=sim.valve_class,
                predicted_mortality_30d=sim.predicted_mortality_30d,
                predicted_ppm_30d=sim.predicted_ppm_30d,
                predicted_pvl_moderate=sim.predicted_pvl_moderate,
                sizing=sizing,
                coronary_risk=coronary_risk,
                considerations=considerations,
                notes=sim.notes,
            )
        )

    has_ct_inputs = any(
        x is not None
        for x in (
            patient.annular_area_mm2,
            patient.calcium_volume_au,
            patient.membranous_septum_length_mm,
            patient.distance_to_left_main_mm,
            patient.distance_to_right_coronary_mm,
            patient.sinus_of_valsalva_diameter_mm,
        )
    )

    return RiskOutput(
        severity=severity,
        futility=futility,
        sts_prom=ScoreEstimate(
            name="STS-PROM 2018 (reduced-form)",
            raw_probability=round(sts_raw, 4),
            recalibrated_probability=round(sts_recal, 4),
            decile=decile,
            miscalibration_note=f"Era-aware O/E ratio for decile {decile}: {oe:.2f}",
        ),
        euroscore_ii=ScoreEstimate(
            name="EuroSCORE II (reduced-form)",
            raw_probability=round(es2, 4),
        ),
        tvt=ScoreEstimate(
            name="ACC/STS TVT Registry (Edwards 2016)",
            raw_probability=round(tvt, 4),
            miscalibration_note=(
                "TAVI-native; powers the ACC TAVR Risk Calculator. "
                "Best-calibrated of the three external scores in modern cohorts "
                "(Pilgrim 2017 slope 0.83; Vemulapalli 2024 O/E 0.80)."
            ),
        ),
        lgbm=ScoreEstimate(
            name=primary_name,
            raw_probability=round(primary_prob, 4),
        ),
        brdav=brdav_score,
        primary_model_name=primary_model_name,
        lgbm_ci=(round(lgbm_lo, 4), round(lgbm_hi, 4)),
        lgbm_decile=lgbm_decile,
        lgbm_base_rate_comparison=base_rate_multiplier,
        risk_score_drivers=risk_score_drivers,
        shap_top5=shap_top5,
        decision_curve=_decision_curve(primary_prob),
        complication_risks=complication_risks,
        device_assessments=device_assessments,
        miscalibration_zone=miscal,
        miscalibration_message=miscalibration_message(sts_raw, sts_recal),
        feature_summary={**patient.model_dump()},
        has_ct_inputs=has_ct_inputs,
    )
