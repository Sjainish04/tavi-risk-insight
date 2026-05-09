"""Pydantic schemas for the public API surface."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# ---------- Patient input ----------


class PatientInput(BaseModel):
    """Patient features used for TAVI risk prediction.

    Field constraints reflect plausible clinical ranges; out-of-range values
    return 422 from the API and prompt the user to recheck.
    """

    # Demographics
    age_years: float = Field(..., ge=18, le=110)
    sex: Literal["male", "female"]
    bmi: float = Field(..., ge=12, le=70)

    # Hemodynamics / labs
    lvef_pct: float = Field(..., ge=5, le=80, description="Left-ventricular ejection fraction (%)")
    egfr: float = Field(..., ge=5, le=120, description="eGFR (CKD-EPI 2021), mL/min/1.73m^2")
    creatinine_mg_dl: float = Field(..., ge=0.3, le=15)
    hemoglobin_g_dl: float = Field(..., ge=4, le=20)
    albumin_g_dl: float = Field(..., ge=1.0, le=6.0)
    nt_probnp_pg_ml: float | None = Field(None, ge=0, le=70_000)

    # Aortic-valve hemodynamics (echo) — required for severity assessment
    aortic_valve_area_cm2: float = Field(..., ge=0.2, le=4.0, description="AVA (cm^2)")
    mean_aortic_gradient_mmhg: float = Field(
        ..., ge=0, le=120, description="Mean transaortic gradient (mmHg)"
    )
    peak_aortic_velocity_m_per_s: float = Field(
        ..., ge=1.0, le=7.0, description="Peak aortic jet velocity (m/s)"
    )

    # Concomitant valve disease + valve morphology
    aortic_regurgitation_grade: int = Field(
        0, ge=0, le=3, description="0=none, 1=mild, 2=moderate, 3=severe"
    )
    bicuspid_valve: bool = False

    # Comorbidities (binary flags)
    diabetes: bool = False
    chronic_lung_disease: bool = False
    prior_mi: bool = False
    prior_pci: bool = False
    prior_cabg: bool = False
    prior_stroke: bool = False
    peripheral_vascular_disease: bool = False
    atrial_fibrillation: bool = False
    prior_pacemaker: bool = False
    on_dialysis: bool = False

    # Clinical state
    nyha_class: Literal["I", "II", "III", "IV"] = "II"
    urgency: Literal["elective", "urgent", "emergent"] = "elective"

    # Frailty proxies (optional)
    gait_speed_m_per_s: float | None = Field(None, ge=0.0, le=2.5)
    five_chair_rises_s: float | None = Field(None, ge=3, le=120)
    clinical_frailty_scale: int | None = Field(
        None, ge=1, le=9, description="Rockwood Clinical Frailty Scale 1-9"
    )

    # CT-derived anatomical features (optional — typically populated from PACS / 3mensio)
    annular_area_mm2: float | None = Field(None, ge=200, le=900)
    annular_perimeter_mm: float | None = Field(None, ge=50, le=120)
    calcium_volume_au: float | None = Field(None, ge=0, le=8_000)
    membranous_septum_length_mm: float | None = Field(None, ge=1, le=20)
    distance_to_left_main_mm: float | None = Field(None, ge=4, le=25)
    distance_to_right_coronary_mm: float | None = Field(None, ge=4, le=25)
    sinus_of_valsalva_diameter_mm: float | None = Field(None, ge=20, le=50)


# ---------- Building blocks ----------


class ProbabilityWithCI(BaseModel):
    """Probability with 95% CI, base rate, and multiplier vs base."""

    p: float = Field(..., ge=0, le=1)
    lo: float = Field(..., ge=0, le=1)
    hi: float = Field(..., ge=0, le=1)
    base_rate: float = Field(..., ge=0, le=1)
    multiplier_vs_base: float = Field(..., ge=0)


class ScoreEstimate(BaseModel):
    """Single risk-score result with optional calibration metadata."""

    name: str
    raw_probability: float = Field(..., ge=0, le=1)
    recalibrated_probability: float | None = Field(None, ge=0, le=1)
    decile: int | None = Field(None, ge=0, le=9)
    miscalibration_note: str | None = None


class ShapContribution(BaseModel):
    feature: str
    value: float | str | bool | None
    shap_value: float
    direction: Literal["increases", "decreases"]


class RiskScoreDriver(BaseModel):
    """A clinical-language description of a top SHAP feature."""

    feature_label: str  # e.g., "Albumin 2.9 g/dL"
    raw_feature_name: str
    current_value: str
    effect: Literal["increases", "decreases"]
    magnitude_pp: float  # impact in absolute percentage points
    is_modifiable: bool
    modify_to: str | None = None  # e.g., ">= 3.5 g/dL before procedure"


class DecisionCurvePoint(BaseModel):
    threshold: float
    net_benefit_model: float
    net_benefit_treat_all: float
    net_benefit_treat_none: float = 0.0


# ---------- Phase 1: severity + futility ----------


class SeverityAssessment(BaseModel):
    is_severe: bool
    severity_class: Literal[
        "severe", "very_severe", "low_flow_low_gradient", "moderate", "not_severe"
    ]
    criteria_met: list[str]
    notes: str | None = None


class FutilityAssessment(BaseModel):
    is_futile: bool
    composite_score: float = Field(..., ge=0, le=1)
    drivers: list[str]
    alternative: str = (
        "Medical therapy (diuretics, neurohormonal blockade, palliative-care referral). "
        "SAVR is not appropriate when TAVI is futile."
    )
    evidence: str = (
        "Composite frailty + comorbidity score; threshold 0.50. "
        "ACC/AHA 2020 Valve Guideline supports medical therapy for severe AS with "
        "limited life expectancy regardless of valve approach."
    )


# ---------- Phase 2: complications ----------


class ComplicationRisks(BaseModel):
    stroke_30d: ProbabilityWithCI
    aki_2_3_30d: ProbabilityWithCI
    major_vascular_30d: ProbabilityWithCI
    life_threatening_bleed_30d: ProbabilityWithCI


# ---------- Phase 3: device assessment ----------


class AnnularSizing(BaseModel):
    recommended_size_mm: int | None
    recommended_size_label: str
    oversizing_pct: float | None
    in_range: bool
    note: str


class CoronaryObstructionRisk(BaseModel):
    grade: Literal["low", "intermediate", "high"]
    reasons: list[str]


class DeviceAssessment(BaseModel):
    """Per-device combined output: complication probabilities + sizing + coronary + considerations."""

    valve: str
    valve_class: Literal[
        "balloon-expandable",
        "self-expanding-supra-annular",
        "self-expanding-intra-annular",
    ]
    predicted_mortality_30d: float = Field(..., ge=0, le=1)
    predicted_ppm_30d: float = Field(..., ge=0, le=1)
    predicted_pvl_moderate: float = Field(..., ge=0, le=1)
    sizing: AnnularSizing
    coronary_risk: CoronaryObstructionRisk
    considerations: list[str]
    notes: list[str] = Field(default_factory=list)


# Backward-compatible alias used by simulation/per_device.py
class DeviceSimulation(BaseModel):
    """Deprecated: use DeviceAssessment. Kept for the existing simulate_devices()."""

    valve: str
    valve_class: Literal[
        "balloon-expandable",
        "self-expanding-supra-annular",
        "self-expanding-intra-annular",
    ]
    predicted_mortality_30d: float = Field(..., ge=0, le=1)
    predicted_ppm_30d: float = Field(..., ge=0, le=1)
    predicted_pvl_moderate: float = Field(..., ge=0, le=1)
    notes: list[str] = Field(default_factory=list)


# ---------- Full /predict response ----------


class RiskOutput(BaseModel):
    """Full /predict response."""

    # Phase 1: AS severity + futility
    severity: SeverityAssessment
    futility: FutilityAssessment

    # Existing risk scores
    sts_prom: ScoreEstimate
    euroscore_ii: ScoreEstimate
    tvt: ScoreEstimate
    lgbm: ScoreEstimate
    # Optional Brüggemann 2024 oracle (real-cohort-trained, all-cause follow-up mortality)
    brdav: ScoreEstimate | None = None
    # Which model produced the headline lgbm probability
    primary_model_name: str = "v1_lgbm"

    # Risk-score accompaniments for the LightGBM headline
    lgbm_ci: tuple[float, float]
    lgbm_decile: int = Field(..., ge=0, le=9)
    lgbm_base_rate_comparison: float  # multiplier vs cohort base rate

    # Drivers in clinical language with modifiable flags
    risk_score_drivers: list[RiskScoreDriver]

    # Legacy SHAP top-5 (kept for ShapWaterfall backward compat)
    shap_top5: list[ShapContribution]

    # Decision curve
    decision_curve: list[DecisionCurvePoint]

    # Phase 2: procedural complications
    complication_risks: ComplicationRisks

    # Phase 3: per-device assessments (replaces device_simulations)
    device_assessments: list[DeviceAssessment] = Field(default_factory=list)

    # Calibration drift signal
    miscalibration_zone: bool = False
    miscalibration_message: str | None = None

    # Echo
    feature_summary: dict[str, float | str | bool | None]
    has_ct_inputs: bool = False


# ---------- Explain ----------


class ExplainRequest(BaseModel):
    """Payload for the streamed /explain endpoint."""

    features: dict[str, float | str | bool | None]
    sts_prom_raw: float
    sts_prom_recalibrated: float
    euroscore_ii: float
    tvt: float
    lgbm_probability: float
    shap_top5: list[ShapContribution]
    miscalibration_zone: bool
    # New context for richer Heart Team note
    severity_class: str | None = None
    futility_flag: bool = False
    complication_top: list[str] = Field(default_factory=list)
    device_pick_reason: str | None = None
    top_modifiable_driver: str | None = None


# ---------- Health ----------


class HealthStatus(BaseModel):
    status: Literal["ok", "degraded", "starting"]
    version: str
    model_loaded: bool
    llm_provider: str
    region: str
    granite_model_id: str
